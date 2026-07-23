import { describe, expect, it } from 'vitest'
import { createRestoreCompatibleSchema } from './verify-recovery'

describe('createRestoreCompatibleSchema', () => {
  it('removes unavailable extensions and event triggers while retaining application objects', () => {
    const schema = `SET transaction_timeout = 0;
--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';

--
-- Name: records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records (id bigint NOT NULL);

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();

--
-- PostgreSQL database dump complete
--
`

    const compatible = createRestoreCompatibleSchema(schema)

    expect(compatible).toContain('CREATE TABLE public.records')
    expect(compatible).toContain('PostgreSQL database dump complete')
    expect(compatible).not.toContain('CREATE EXTENSION')
    expect(compatible).not.toContain('COMMENT ON EXTENSION')
    expect(compatible).not.toContain('CREATE EVENT TRIGGER')
    expect(compatible).not.toContain('transaction_timeout')
  })
})
