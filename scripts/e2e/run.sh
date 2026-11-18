cd /home/claude/conexagro
su postgres -c "psql -qc 'DROP DATABASE IF EXISTS smoke' -c 'CREATE DATABASE smoke'" 2>/dev/null
export DATABASE_URL=postgres://conexagro:conexagro@localhost:5432/smoke JWT_SECRET=secreto-de-humo-0123456789-0123456789-abcd MAIL_TRANSPORT=console
npm run migrate >/dev/null 2>&1
npx next start -p 3055 > /tmp/srv.log 2>&1 &
SP=$!; sleep 5
python3 scripts/e2e/e2e.py; echo "exit $?"
echo "errores servidor: $(grep -c 'Error' /tmp/srv.log)"
kill $SP
