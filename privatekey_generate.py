import secrets

private_key = secrets.token_hex(32)  # 32 bytes = 256-bit key
print("Static Private Key:", private_key)
