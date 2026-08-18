with open('resources/js/pages/NetworkInfrastructure.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace:
#   );
# }
# 
# 
#       {/* Modal Detail Port & Monitoring Sinyal ODP */}

bad_str = '''    </div>
  );
}


      {/* Modal Detail Port & Monitoring Sinyal ODP */}'''

good_str = '''
      {/* Modal Detail Port & Monitoring Sinyal ODP */}'''

content = content.replace(bad_str, good_str)

with open('resources/js/pages/NetworkInfrastructure.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('OdpTabContent modal placement fixed!')
