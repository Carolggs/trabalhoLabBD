-- =============================================================
-- SCC-541 Projeto Final — Dia 1: Triggers de sincronização USERS
-- Conceito: triggers AFTER INSERT/UPDATE para manter USERS consistente
--           com DRIVERS e CONSTRUCTORS (req. 5 do enunciado)
-- =============================================================

-- =============================================================
-- TRIGGER: sincronizar DRIVERS → USERS
-- Dispara após INSERT ou UPDATE em drivers.
-- Se login já existir (de outro driver/conflito), CANCELA a operação.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_sync_driver_to_users()
RETURNS TRIGGER AS $$
DECLARE
    v_login     VARCHAR(100);
    v_password  VARCHAR(255);
BEGIN
    v_login    := NEW.driver_ref || '_d';
    v_password := md5(NEW.driver_ref);

    IF TG_OP = 'INSERT' THEN
        -- Req. 5: bloquear login duplicado — lança exceção para cancelar INSERT no driver
        IF EXISTS (SELECT 1 FROM USERS WHERE login = v_login) THEN
            RAISE EXCEPTION 'Login "%" já existe em USERS. Inserção em DRIVERS cancelada.', v_login;
        END IF;

        INSERT INTO USERS (login, password, tipo, id_original)
        VALUES (v_login, v_password, 'Piloto', NEW.id);

    ELSIF TG_OP = 'UPDATE' THEN
        -- Se driver_ref mudou, o login muda também; verificar conflito
        IF OLD.driver_ref <> NEW.driver_ref THEN
            IF EXISTS (SELECT 1 FROM USERS WHERE login = v_login AND id_original <> NEW.id) THEN
                RAISE EXCEPTION 'Login "%" já pertence a outro usuário. UPDATE em DRIVERS cancelado.', v_login;
            END IF;
        END IF;

        UPDATE USERS
        SET login       = v_login,
            password    = v_password
        WHERE id_original = NEW.id AND tipo = 'Piloto';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Associa a função à tabela drivers
DROP TRIGGER IF EXISTS trg_sync_driver_to_users ON drivers;
CREATE TRIGGER trg_sync_driver_to_users
    AFTER INSERT OR UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_driver_to_users();

-- =============================================================
-- TRIGGER: sincronizar CONSTRUCTORS → USERS
-- Mesmo comportamento, para escuderias.
-- =============================================================

CREATE OR REPLACE FUNCTION fn_sync_constructor_to_users()
RETURNS TRIGGER AS $$
DECLARE
    v_login     VARCHAR(100);
    v_password  VARCHAR(255);
BEGIN
    v_login    := NEW.constructor_ref || '_c';
    v_password := md5(NEW.constructor_ref);

    IF TG_OP = 'INSERT' THEN
        IF EXISTS (SELECT 1 FROM USERS WHERE login = v_login) THEN
            RAISE EXCEPTION 'Login "%" já existe em USERS. Inserção em CONSTRUCTORS cancelada.', v_login;
        END IF;

        INSERT INTO USERS (login, password, tipo, id_original)
        VALUES (v_login, v_password, 'Escuderia', NEW.id);

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.constructor_ref <> NEW.constructor_ref THEN
            IF EXISTS (SELECT 1 FROM USERS WHERE login = v_login AND id_original <> NEW.id) THEN
                RAISE EXCEPTION 'Login "%" já pertence a outro usuário. UPDATE em CONSTRUCTORS cancelado.', v_login;
            END IF;
        END IF;

        UPDATE USERS
        SET login       = v_login,
            password    = v_password
        WHERE id_original = NEW.id AND tipo = 'Escuderia';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_constructor_to_users ON constructors;
CREATE TRIGGER trg_sync_constructor_to_users
    AFTER INSERT OR UPDATE ON constructors
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_constructor_to_users();
