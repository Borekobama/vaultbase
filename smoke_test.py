from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    assert page.get_by_text('Good morning, Berke').is_visible()
    assert page.get_by_text('customer-portal').is_visible()
    page.get_by_role('button', name='Add project').click()
    assert page.get_by_text('NEW CONNECTION').is_visible()
    page.get_by_label('Project name').fill('smoke project')
    page.get_by_label('Database connection string').fill('postgresql://test')
    page.get_by_role('button', name='Add project').last.click()
    assert page.get_by_text('smoke-project').is_visible()
    page.get_by_role('button', name='Activity').click()
    assert page.get_by_text('Recent activity').is_visible()
    page.screenshot(path='/tmp/vaultbase-smoke.png', full_page=True)
    browser.close()
