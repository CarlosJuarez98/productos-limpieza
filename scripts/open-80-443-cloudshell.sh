#!/bin/bash
# Run in OCI Cloud Shell. Opens TCP 80 and 443 (HTTPS/Caddy ACME) on the NSG(s)
# of the VM with public IP 163.192.146.143.
set -euo pipefail

PUBLIC_IP="${PUBLIC_IP:-163.192.146.143}"

echo "Looking up private IP for public IP $PUBLIC_IP ..."
PRIV_JSON=$(oci network public-ip get --public-ip-address "$PUBLIC_IP" 2>/dev/null || true)
if [[ -z "${PRIV_JSON}" ]]; then
  echo "Could not resolve public IP via oci."
  exit 1
fi
PRIVATE_IP_OCID=$(echo "$PRIV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['privateIpId'])")
VNIC_OCID=$(oci network private-ip get --private-ip-id "$PRIVATE_IP_OCID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['vnicId'])")
NSG_IDS=$(oci network vnic get --vnic-id "$VNIC_OCID" | python3 -c "import sys,json; print('\n'.join(json.load(sys.stdin)['data'].get('nsgIds') or []))")

if [[ -z "$NSG_IDS" ]]; then
  echo "VNIC has no NSGs. Open TCP 80 and 443 in the subnet security list in Console."
  exit 2
fi

echo "NSGs:"
echo "$NSG_IDS"

for PORT in 80 443; do
  while IFS= read -r NSG_ID; do
    [[ -z "$NSG_ID" ]] && continue
    echo "Adding ingress $PORT/tcp to $NSG_ID ..."
    oci network nsg rules add --nsg-id "$NSG_ID" --security-rules "[
      {
        \"description\": \"HTTPS/Caddy ACME $PORT\",
        \"direction\": \"INGRESS\",
        \"isStateless\": false,
        \"protocol\": \"6\",
        \"source\": \"0.0.0.0/0\",
        \"sourceType\": \"CIDR_BLOCK\",
        \"tcpOptions\": {\"destinationPortRange\": {\"min\": $PORT, \"max\": $PORT}}
      }
    ]" || echo "Rule add failed or already exists for $NSG_ID port $PORT"
  done <<< "$NSG_IDS"
done

echo "Done. After ~1-2 min (and LE rate limit if any), test:"
echo "  curl -I https://productos.163.192.146.143.sslip.io/"
