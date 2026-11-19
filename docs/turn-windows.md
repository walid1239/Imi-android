# تشغيل Coturn محلياً على Windows 10/11

هذا دليل اختبار فقط. لا يشغّل المستودع الخادم نيابةً عنك، ولا يفتح منافذ أو يغيّر الراوتر أو Windows Firewall تلقائياً. نفّذ الخطوات بنفسك، ولا ترفع ملف `infra/coturn/.env` أو توكن DuckDNS إلى Git.

## 1) Docker Desktop مع WSL2

1. ثبّت WSL2 من PowerShell كمسؤول:
   ```powershell
   wsl --install
   wsl --update
   ```
2. أعد تشغيل Windows، ثم ثبّت Docker Desktop من الموقع الرسمي، واختر **Use the WSL 2 based engine**.
3. افتح Docker Desktop وانتظر حتى تظهر حالة Engine running.
4. تحقق:
   ```powershell
   wsl --status
   docker version
   docker compose version
   ```

## 2) فحص CGNAT أو Double NAT

1. افتح لوحة الراوتر وابحث عن WAN/Internet IPv4 وسجّل العنوان.
2. من الحاسوب افتح موقعاً موثوقاً لعرض عنوان IP العام مثل `https://api.ipify.org`.
3. قارن العنوانين. إذا كان عنوان WAN مختلفاً عن العنوان العام، فهذا يعني وجود NAT أعلى الراوتر (قد يكون CGNAT لدى المزود أو راوتر/مودم آخر؛ ليس دليلاً قاطعاً وحده على CGNAT).
4. إذا كان WAN ضمن `100.64.0.0/10` أو نطاق خاص مثل `10/8` أو `172.16/12` أو `192.168/16`، فغالباً لا تملك IPv4 عاماً مباشراً.
5. اطلب من مزود الإنترنت IPv4 عاماً عاماً غير مشترك، أو استخدم المرحلة الثانية (VPS/خدمة مُدارة). لا تحاول تجاوز CGNAT بفتح منافذ محلية؛ لن تصل الاتصالات الواردة إلى الراوتر.

## 3) تثبيت عنوان LAN للحاسوب

من إعدادات الراوتر أنشئ DHCP reservation لعنوان MAC الخاص بالحاسوب، مثلاً `192.168.1.50`. هذا عنوان Windows LAN الذي ستوجّه إليه منافذ الراوتر؛ لا تخلطه بعنوان الحاوية الثابت `172.30.250.10` داخل Docker. تحقق في PowerShell:
```powershell
ipconfig
Get-NetIPConfiguration
```
لا تستخدم عنواناً ثابتاً خارج نطاق الشبكة الذي يحدده الراوتر.

## 4) DuckDNS وتحديث IP تلقائياً

1. أنشئ نطاقاً فرعياً مجانياً في DuckDNS من موقعه الرسمي، واحتفظ بالتوكن خارج المستودع.
2. أنشئ متغير بيئة لمستخدم Windows (لا تضع التوكن في أمر محفوظ أو ملف Git):
   ```powershell
   [Environment]::SetEnvironmentVariable("DUCKDNS_TOKEN", "ضع-التوكن-محلياً", "User")
   ```
   أغلق PowerShell وافتحه مجدداً لتحديث البيئة.
3. انسخ ملف المثال:
   ```powershell
   Set-Location path\to\Imi-android\infra\coturn
   Copy-Item .env.example .env
   notepad .env
   ```
   أدخل اسم DuckDNS في `DUCKDNS_DOMAIN`، واسم المضيف في `TURN_HOST` و`TURN_REALM`. اترك `TURN_EXTERNAL_IP` مؤقتاً إلى أن تنفذ السكربت.
4. ولّد السر كما في الخطوة 7 ثم أدخله في `.env` محلياً.
5. حدّث DuckDNS وعنوان NAT:
   ```powershell
   .\update-duckdns.ps1
   ```
6. لإنشاء مهمة مجدولة كل 5 دقائق:
   ```powershell
   $script = (Resolve-Path .\update-duckdns.ps1).Path
   $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
   $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
   Register-ScheduledTask -TaskName "IMI-DuckDNS-Update" -Action $action -Trigger $trigger -Description "Refresh IMI home TURN public IP"
   ```
   شغّل المهمة بحساب Windows نفسه الذي يملك متغير `DUCKDNS_TOKEN`. راجع سجل Task Scheduler عند الفشل.

> السكربت يحدّث DuckDNS و`TURN_EXTERNAL_IP` في ملف .env بصيغة `PUBLIC_IP/172.30.250.10`. العنوان الثاني هو عنوان Coturn الثابت داخل شبكة Docker المعرفة في Compose، وليس عنوان Windows LAN. عنوان Windows LAN الذي ثبّتّه في الخطوة السابقة هو وجهة Port Forwarding في الراوتر. إذا غيّرت شبكة Docker أو عنوان الحاوية، حدّث `docker-compose.yml` والسكربت معاً. إذا تغيّر IP العام، أعد تشغيل الحاوية.

## 5) Port Forwarding في الراوتر

أنشئ قواعد توجيه إلى عنوان LAN الثابت للحاسوب فقط:

| المنفذ الخارجي | البروتوكول | الوجهة |
|---|---|---|
| 3478 | UDP | LAN-IP للحاسوب:3478 |
| 3478 | TCP | LAN-IP للحاسوب:3478 |
| 49160–49200 | UDP | النطاق نفسه على الحاسوب |

لا تفتح 5349 أو أي نطاق آخر الآن. لا تضع الحاسوب في DMZ.

## 6) Windows Defender Firewall

افتح PowerShell كمسؤول، ثم نفّذ القواعد الضيقة التالية:
```powershell
New-NetFirewallRule -DisplayName "IMI Coturn 3478 UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 3478 -Profile Any
New-NetFirewallRule -DisplayName "IMI Coturn 3478 TCP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3478 -Profile Any
New-NetFirewallRule -DisplayName "IMI Coturn Relay UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 49160-49200 -Profile Any
```
لا تضف قواعد أوسع. عند الانتهاء أو عدم الحاجة للخادم:
```powershell
Remove-NetFirewallRule -DisplayName "IMI Coturn 3478 UDP"
Remove-NetFirewallRule -DisplayName "IMI Coturn 3478 TCP"
Remove-NetFirewallRule -DisplayName "IMI Coturn Relay UDP"
```

## 7) توليد TURN_SECRET عشوائي

في PowerShell:
```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = [Convert]::ToBase64String($bytes)
$secret
```
انسخ الناتج مباشرة إلى `TURN_SECRET` في `infra/coturn/.env` فقط. لا ترسله في المحادثة، ولا تضفه إلى Git أو صور الشاشة أو السجلات. يجب إدخال القيمة نفسها لاحقاً في Firebase Secret Manager بواسطة مالك المشروع، بعد موافقته على عملية إنشاء السر.

## 8) التشغيل والسجلات والإيقاف

من مجلد `infra/coturn`:
```powershell
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 -f coturn
```
أوقف الحاوية:
```powershell
docker compose down
```
عند الانتهاء من الاختبار، أوقف الحاوية ثم احذف قواعد Firewall وأزل Port Forwarding من الراوتر. إيقاف الحاوية وحده لا يغلق قواعد الراوتر أو Firewall.

## 9) اختبار Trickle ICE من شبكة مختلفة

1. شغّل Coturn وتأكد أن السجلات لا تعرض أخطاء إعداد أو مصادقة.
2. افتح صفحة Trickle ICE الخاصة بعينة WebRTC في جهاز على شبكة مختلفة. استخدم بيانات الهاتف مع إيقاف Wi-Fi، لا تستخدم Wi-Fi المنزل نفسه.
3. أضف:
   - `stun:stun.l.google.com:19302`
   - `turn:TURN_HOST:3478?transport=udp`
4. استخدم اسم مستخدم مؤقتاً وكلمة مرور مولّدين من دالة IMI بعد إعداد Firebase؛ لا تستخدم السر المشترك ككلمة مرور للمتصفح.
5. ابدأ جمع المرشحين. نجاح TURN يظهر مرشحاً من نوع `relay`. ظهور `srflx` فقط لا يثبت نجاح الترحيل.
6. إذا لم يظهر `relay`: افحص CGNAT، Port Forwarding، Windows Firewall، نطاق relay، تطابق السر، و`TURN_EXTERNAL_IP`.

## 10) تحذيرات أمنية وتشغيلية

- أبقِ `use-auth-secret` مفعّلاً دائماً؛ لا تستخدم `no-auth` ولا تشارك السر المشترك.
- بيانات TURN المؤقتة قصيرة العمر ومخصصة لمستخدم واحد؛ لا تضعها في تقارير عامة.
- راقب استهلاك الرفع والتنزيل وعدد التخصيصات والسجلات؛ Coturn يمرر الوسائط وقد يستهلك باقة الإنترنت.
- أغلق المنافذ والحاوية عند عدم الاستخدام، ولا تفتح لوحة إدارة أو CLI للإنترنت.
- الصوت والصورة يمران عبر سرعة رفع الإنترنت المنزلي عند استخدام relay؛ إذا كان الرفع ضعيفاً أو غير مستقر فستتأثر الجودة.
- هذا إعداد اختبار منزلي، وليس ضمان توافر. عند CGNAT أو انقطاع الكهرباء/الإنترنت، انتقل إلى خادم مستقل قبل الإطلاق.

## TLS لاحقاً

عند امتلاك نطاق وشهادة TLS صحيحة، أزل `no-tls` و`no-dtls` من ملف الإعداد، وأضف `tls-listening-port=5349` ومساري الشهادة والمفتاح. أضف نشر `5349:5349/tcp` إلى `docker-compose.yml` وأضف mount للملفات من مجلد محلي غير متعقب، ثم افتح `5349/tcp` فقط عند الحاجة واختبر `turns:`. لا تستخدم شهادة ذاتية التوقيع في الإنتاج.
