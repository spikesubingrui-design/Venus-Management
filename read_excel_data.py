# -*- coding: utf-8 -*-
import pandas as pd
import json
import os

base = os.path.dirname(os.path.abspath(__file__))

# 读取教职工通讯录
staff_path = os.path.join(base, '外界信息', '学校档案（data）', '1.教职工通讯录.xlsx')
df_staff = pd.read_excel(staff_path, header=1)
print('=== 教职工通讯录 ===')
print(f'列名: {list(df_staff.columns)}')
print(f'总行数: {len(df_staff)}')
# 打印前3行
for i, row in df_staff.head(3).iterrows():
    print(dict(row))
print()

# 读取学生模板
student_path = os.path.join(base, '外界信息', '学校档案（data）', '2.学生模板.xlsx')
# 尝试读取所有sheet
xls = pd.ExcelFile(student_path)
print(f'=== 学生模板 ===')
print(f'Sheet names: {xls.sheet_names}')

for sheet in xls.sheet_names:
    df = pd.read_excel(student_path, sheet_name=sheet, header=0)
    print(f'\n--- Sheet: {sheet} ---')
    print(f'列名: {list(df.columns)}')
    print(f'总行数: {len(df)}')
    for i, row in df.head(3).iterrows():
        print(dict(row))
