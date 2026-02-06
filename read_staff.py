# -*- coding: utf-8 -*-
import pandas as pd
import json
import os

# 读取教职工通讯录（跳过第一行表头）
file_path = os.path.join(os.path.dirname(__file__), '外界信息', '学校档案（data）', '1.教职工通讯录.xlsx')
df = pd.read_excel(file_path, header=1)  # 使用第二行作为表头

print(f"总人数: {len(df)}")
print(f"列名: {df.columns.tolist()}")

# 生成JSON格式数据用于导入小程序
staff_list = []
for idx, row in df.iterrows():
    name = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
    phone = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
    gender = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ''
    class_name = str(row.iloc[3]).strip() if pd.notna(row.iloc[3]) else ''
    position = str(row.iloc[4]).strip() if pd.notna(row.iloc[4]) else '教师'
    
    # 跳过表头行或无效行
    if name == '姓名' or name == '' or name == 'nan':
        continue
        
    # 处理手机号（去除小数点）
    if '.' in phone:
        phone = phone.split('.')[0]
    
    staff = {
        'id': f'staff_{len(staff_list)+1}',
        'name': name,
        'phone': phone,
        'role': position if position and position != 'nan' else '教师',
        'gender': gender if gender and gender != 'nan' else '',
        'assignedClasses': [class_name] if class_name and class_name != 'nan' else []
    }
    staff_list.append(staff)

print(f"\n有效教职工数量: {len(staff_list)}")
print("\n教职工名单:")
for s in staff_list:
    print(f"  {s['name']} - {s['phone']} - {s['role']} - {s['assignedClasses']}")

# 保存为JSON
output_path = os.path.join(os.path.dirname(__file__), 'staff_data.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(staff_list, f, ensure_ascii=False, indent=2)
print(f"\n已导出到: {output_path}")
