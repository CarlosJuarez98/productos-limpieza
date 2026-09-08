#!/bin/bash
set -euo pipefail
mkdir -p /tmp/plmig
cd /tmp/plmig
docker cp control-gastos-api:/app/app.jar ./app.jar
rm -rf BOOT-INF
unzip -qo app.jar "BOOT-INF/lib/*.jar"
cp /tmp/CreatePlUser.java .
OJDBC=$(ls BOOT-INF/lib/ojdbc*.jar | head -1)
CP="$OJDBC"
for j in BOOT-INF/lib/oraclepki*.jar BOOT-INF/lib/osdt_core*.jar BOOT-INF/lib/osdt_cert*.jar BOOT-INF/lib/orai18n*.jar; do
  [ -f "$j" ] && CP="$CP:$j"
done
javac -cp "$OJDBC" CreatePlUser.java
rm -rf /tmp/pl_wallet_jdbc
mkdir -p /tmp/pl_wallet_jdbc
cp -a /home/opc/control-gastos/wallet/. /tmp/pl_wallet_jdbc/
# Keep pem for jdbc? jdbc uses sso - leave all
sed -i "s|DIRECTORY=\"[^\"]*\"|DIRECTORY=\"/tmp/pl_wallet_jdbc\"|g" /tmp/pl_wallet_jdbc/sqlnet.ora
java -Doracle.net.tns_admin=/tmp/pl_wallet_jdbc -cp ".:$CP" CreatePlUser "$ATP_ADMIN_PASSWORD"
echo DONE
