# 打包實時版：dist/release/DW1-Monitor-Mac.zip、DW1-Monitor-Windows.zip
import zipfile, os, time
L='live'; OUT='dist/release'; os.makedirs(OUT,exist_ok=True)
TOP='DW1暴龍機實時版'
common=['index.html','dw1_bridge.py','使用說明.txt']
sets={'Mac':common+['先讀我：Mac 安裝說明.txt','Mac 啟動（只限這部電腦）.command','Mac 啟動（iPad 也可以看）.command'],
      'Windows':common+['先讀我：Windows 安裝說明.txt','Windows 啟動（只限這部電腦）.bat','Windows 啟動（iPad 也可以看）.bat']}
for plat,files in sets.items():
    path=f'{OUT}/DW1-Monitor-{plat}.zip'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for f in files:
            data=open(os.path.join(L,f),'rb').read()
            if plat=='Windows' and (f.endswith('.txt')):
                data=data.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
            zi=zipfile.ZipInfo(f'{TOP}/{f}',date_time=time.localtime()[:6]); zi.compress_type=zipfile.ZIP_DEFLATED
            zi.create_system=3; zi.external_attr=((0o100755 if f.endswith('.command') else 0o100644)<<16)
            z.writestr(zi,data)
    print(path, os.path.getsize(path))
