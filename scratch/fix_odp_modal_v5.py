with open('resources/js/pages/NetworkInfrastructure.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 2307 (0-indexed 2306): `          })}`
# Line 2494 (0-indexed 2493): `/* ══════════════════════════════════════════════════════════════════`

clean_lines = lines[:2307] + [
    "        </div>\n",
    "      )}\n",
    "    </div>\n",
    "  );\n",
    "}\n\n"
] + lines[2494:]

with open('resources/js/pages/NetworkInfrastructure.jsx', 'w', encoding='utf-8') as f:
    f.writelines(clean_lines)

print("v5 cleaned successfully!")
