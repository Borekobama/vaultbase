from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright


def api_token():
    for line in Path('server/.env').read_text().splitlines():
        if line.startswith('VAULTBASE_API_TOKEN='):
            return line.split('=', 1)[1]
    raise RuntimeError('VAULTBASE_API_TOKEN is missing')


def sign_in(page):
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.get_by_label('Vaultbase key').fill(api_token())
    page.get_by_role('button', name='Unlock Vaultbase').click()
    page.get_by_role('heading', name='Good morning, Berke').wait_for()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    sign_in(page)

    page.add_script_tag(path='node_modules/axe-core/axe.min.js')
    axe = page.evaluate("axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })")
    serious = [item for item in axe['violations'] if item['impact'] in ('serious', 'critical')]
    assert not serious, serious

    page.get_by_role('button', name='Add project').click()
    page.get_by_label('Project name').fill('smoke project')
    page.get_by_label('Supabase plan').select_option('pro')
    page.get_by_label('Protection mode').select_option('database')
    page.get_by_label('Database connection string').fill('postgresql://postgres.smokeprojectref:temporary-test-password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres')
    page.get_by_role('button', name='Add project').last.click()
    page.get_by_text('smoke-project', exact=True).wait_for()
    assert page.get_by_text('eu-north-1', exact=False).is_visible()

    page.get_by_role('button', name='Planner').click()
    assert page.get_by_text('Measure first dump', exact=True).is_visible()
    page.get_by_role('button', name='Secrets').click()
    assert page.get_by_text('supabase/smoke-project/database').is_visible()
    page.get_by_role('button', name='Activity').click()
    assert page.get_by_role('heading', name='Recent activity').is_visible()
    page.get_by_role('button', name='Settings').click()
    assert page.get_by_text('Cloudflare R2 · encrypted Restic repository').is_visible()

    status = page.evaluate("fetch('/api/projects/smoke-project', {method: 'DELETE', headers: {'X-Vaultbase-CSRF': '1'}}).then(response => response.status)")
    assert status == 204
    subprocess.run(['psql', '-d', 'vaultbase', '-c', "DELETE FROM vaultbase.audit_events WHERE target_id='smoke-project'"], check=True, capture_output=True)

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    sign_in(mobile)
    assert mobile.get_by_role('button', name='Projects').is_visible()
    mobile.screenshot(path='/tmp/vaultbase-mobile.png', full_page=True)
    page.screenshot(path='/tmp/vaultbase-production.png', full_page=True)
    browser.close()
