# -*- coding: utf-8 -*-
"""
将教职工数据上传到阿里云OSS
"""
import json
import hmac
import hashlib
import base64
import urllib.request
import urllib.parse
from datetime import datetime, timezone
import os

# 阿里云OSS配置
OSS_CONFIG = {
    'region': 'oss-cn-beijing',
    'bucket': 'venus-data',
    'accessKeyId': 'LTAI5t8bGTe6ZJAuKSQXi3Di',
    'accessKeySecret': 'eu2urgQIcJ6eK0s87UkZLEbgk1qacj',
    'endpoint': 'https://venus-data.oss-cn-beijing.aliyuncs.com',
}

DATA_PREFIX = 'jinxing-edu'

def sign_oss_request(method, resource, content_type='application/json', content_md5=''):
    """生成OSS请求签名"""
    date = datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')
    
    string_to_sign = f"{method}\n{content_md5}\n{content_type}\n{date}\n/{OSS_CONFIG['bucket']}{resource}"
    
    signature = base64.b64encode(
        hmac.new(
            OSS_CONFIG['accessKeySecret'].encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha1
        ).digest()
    ).decode('utf-8')
    
    return {
        'Authorization': f"OSS {OSS_CONFIG['accessKeyId']}:{signature}",
        'Date': date,
        'Content-Type': content_type,
    }

def upload_to_oss(storage_key, data):
    """上传数据到OSS"""
    resource = f"/{DATA_PREFIX}/{storage_key}.json"
    url = f"{OSS_CONFIG['endpoint']}{resource}"
    
    json_data = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
    
    headers = sign_oss_request('PUT', resource)
    headers['Content-Length'] = str(len(json_data))
    
    req = urllib.request.Request(url, data=json_data, headers=headers, method='PUT')
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"上传成功: {url}")
            print(f"状态码: {response.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"上传失败: {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
        return False

def main():
    # 读取教职工数据
    staff_file = os.path.join(os.path.dirname(__file__), 'staff_data.json')
    with open(staff_file, 'r', encoding='utf-8') as f:
        staff_data = json.load(f)
    
    print(f"准备上传 {len(staff_data)} 名教职工数据...")
    
    # 上传到OSS
    success = upload_to_oss('kt_staff', staff_data)
    
    if success:
        print(f"\n✅ 成功上传 {len(staff_data)} 名教职工到云端！")
        print("小程序现在可以同步获取最新数据了。")
    else:
        print("\n❌ 上传失败，请检查配置")

if __name__ == '__main__':
    main()
