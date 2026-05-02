import csv

# Read the file
with open('major_catalog_corrected.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Merge field codes: changed > field_code > original_field_code
merged_rows = []
for row in rows:
    # Get values from columns
    changed = row['changed'].strip()
    field_code = row['field_code'].strip()
    original_field_code = row['original_field_code'].strip()
    
    # Logic: if changed is YES, use field_code; otherwise use original_field_code or field_code
    if changed == 'YES':
        # Use field_code (the new value)
        merged_field_code = field_code
    elif original_field_code:
        # No change, use original_field_code
        merged_field_code = original_field_code
    else:
        # Fall back to field_code
        merged_field_code = field_code
    
    # Create new row with merged field_code
    new_row = {
        'code': row['code'],
        'name': row['name'],
        'field_code': merged_field_code,
        'description': row['description']
    }
    merged_rows.append(new_row)

# Write the updated file
with open('major_catalog_corrected.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['code', 'name', 'field_code', 'description'])
    writer.writeheader()
    writer.writerows(merged_rows)

print(f'✓ Hợp nhất cột xong!')
print(f'✓ Tổng: {len(merged_rows)} hàng')
print(f'✓ Cột mới: code, name, field_code, description')
