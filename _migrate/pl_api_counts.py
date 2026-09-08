import urllib.request, json
for ep in ["inventario","ventas","entradas","precios"]:
  d=json.load(urllib.request.urlopen("http://127.0.0.1:8083/api/"+ep))
  print(ep, len(d) if isinstance(d,list) else type(d))
