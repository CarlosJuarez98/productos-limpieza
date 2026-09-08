#!/bin/bash
set -euo pipefail
DUMP="${1:-/home/opc/productos-limpieza/_migrate/full_dump.json}"
mkdir -p /tmp/plimp
cd /tmp/plimp
docker cp productos-limpieza-api:/app/app.jar ./app.jar
rm -rf BOOT-INF
unzip -qo app.jar "BOOT-INF/lib/*.jar"
cp /home/opc/productos-limpieza/_migrate/ImportPlJson.java .
OJDBC=$(ls BOOT-INF/lib/ojdbc*.jar | head -1)
JACKSON=$(ls BOOT-INF/lib/jackson-databind-*.jar | head -1)
JCORE=$(ls BOOT-INF/lib/jackson-core-*.jar | head -1)
JANN=$(ls BOOT-INF/lib/jackson-annotations-*.jar | head -1)
CP="$OJDBC:$JACKSON:$JCORE:$JANN"
for j in BOOT-INF/lib/oraclepki*.jar BOOT-INF/lib/osdt_core*.jar BOOT-INF/lib/osdt_cert*.jar BOOT-INF/lib/orai18n*.jar; do
  [ -f "$j" ] && CP="$CP:$j"
done
echo "Compiling with CP=$CP"
javac -cp "$CP" ImportPlJson.java
rm -rf /tmp/pl_wallet_jdbc
mkdir -p /tmp/pl_wallet_jdbc
cp -a /home/opc/productos-limpieza/wallet/. /tmp/pl_wallet_jdbc/
python3 - <<'PY'
from pathlib import Path
import re
p = Path("/tmp/pl_wallet_jdbc/sqlnet.ora")
text = p.read_text()
p.write_text(re.sub(r'DIRECTORY\s*=\s*"[^"]*"', 'DIRECTORY="/tmp/pl_wallet_jdbc"', text, flags=re.I))
print(p.read_text())
PY
PASS=$(docker exec productos-limpieza-api printenv SPRING_DATASOURCE_PASSWORD)
export SPRING_DATASOURCE_PASSWORD="$PASS"
export SPRING_DATASOURCE_USERNAME=productos_limpieza
export SPRING_DATASOURCE_URL="jdbc:oracle:thin:@cgatodb_tp"
java -Doracle.net.tns_admin=/tmp/pl_wallet_jdbc -cp ".:$CP" ImportPlJson "$DUMP"
echo IMPORT_DONE
