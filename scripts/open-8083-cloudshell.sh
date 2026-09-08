#!/bin/bash
# Run in OCI Cloud Shell (mx-queretaro-1). Opens TCP 8083 on the same NSG(s)
# that already allow 8081 for the VM with public IP 163.192.146.143.
set -euo pipefail

PUBLIC_IP="${PUBLIC_IP:-163.192.146.143}"
PORT="${PORT:-8083}"

echo "Looking up private IP for public IP $PUBLIC_IP ..."
PRIV_JSON=$(oci network public-ip get --public-ip-address "$PUBLIC_IP" 2>/dev/null || true)
if [[ -z "${PRIV_JSON}" ]]; then
  echo "Could not resolve public IP via oci. Set PRIVATE_IP_OCID manually."
  exit 1
fi
PRIVATE_IP_OCID=$(echo "$PRIV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['privateIpId'])")
echo "PRIVATE_IP_OCID=$PRIVATE_IP_OCID"

VNIC_OCID=$(oci network private-ip get --private-ip-id "$PRIVATE_IP_OCID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['vnicId'])")
echo "VNIC_OCID=$VNIC_OCID"

NSG_IDS=$(oci network vnic get --vnic-id "$VNIC_OCID" | python3 -c "import sys,json; print('\n'.join(json.load(sys.stdin)['data'].get('nsgIds') or []))")
if [[ -z "$NSG_IDS" ]]; then
  echo "VNIC has no NSGs. Checking subnet security lists is out of scope for this script."
  echo "Open TCP $PORT in the subnet security list in Console, same as 8081."
  exit 2
fi

echo "NSGs:"
echo "$NSG_IDS"

while IFS= read -r NSG_ID; do
  [[ -z "$NSG_ID" ]] && continue
  echo "Adding ingress $PORT/tcp to $NSG_ID ..."
  oci network nsg rules add --nsg-id "$NSG_ID" --security-rules "[
    {
      \"description\": \"productos-limpieza HTTP $PORT\",
      \"direction\": \"INGRESS\",
      \"isStateless\": false,
      \"protocol\": \"6\",
      \"source\": \"0.0.0.0/0\",
      \"sourceType\": \"CIDR_BLOCK\",
      \"tcpOptions\": {\"destinationPortRange\": {\"min\": $PORT, \"max\": $PORT}}
    }
  ]" || echo "Rule add failed or already exists for $NSG_ID"
done <<< "$NSG_IDS"

echo "Done. Test: curl -I http://$PUBLIC_IP:$PORT/"
