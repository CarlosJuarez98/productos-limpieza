#!/bin/bash
set -euo pipefail
mkdir -p ~/productos-limpieza
tar -xzf /tmp/productos-limpieza-cloud.tar.gz -C ~/productos-limpieza
cp /tmp/pl.env.cloud ~/productos-limpieza/.env.cloud
rm -f /tmp/pl.env.cloud /tmp/productos-limpieza-cloud.tar.gz
mkdir -p ~/productos-limpieza/wallet
cp ~/control-gastos/wallet/* ~/productos-limpieza/wallet/
# Force container wallet path
python3 - <<'PY'
from pathlib import Path
p = Path.home() / "productos-limpieza/wallet/sqlnet.ora"
text = p.read_text()
import re
text2 = re.sub(r'DIRECTORY\s*=\s*"[^"]*"', 'DIRECTORY="/wallet"', text, flags=re.I)
p.write_text(text2)
print(p.read_text())
PY
echo "--- tree ---"
ls -la ~/productos-limpieza
ls ~/productos-limpieza/wallet
sudo firewall-cmd --permanent --add-port=8083/tcp || true
sudo firewall-cmd --reload || true
sudo firewall-cmd --list-ports || true
which oci || echo NO_OCI
echo SETUP_DONE
