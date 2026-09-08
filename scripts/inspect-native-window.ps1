param([int]$AppProcessId, [string]$ProbeFile)
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NotchProbe {
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
  [StructLayout(LayoutKind.Sequential)] public struct MonitorInfo {public int Size; public Rect Monitor,Work; public uint Flags;}
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f,IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr h,int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
  [DllImport("user32.dll",CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr m,ref MonitorInfo i);
  [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr h,IntPtr r);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int a,int b,int c,int d);
  [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr r,int x,int y);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr h);
  public static IntPtr Find(uint pid) {IntPtr found=IntPtr.Zero;long area=0;EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);Rect r;GetWindowRect(h,out r);long size=(long)(r.Right-r.Left)*(r.Bottom-r.Top);if(id==pid&&IsWindowVisible(h)&&size>area){found=h;area=size;}return true;},IntPtr.Zero);return found;}
}
'@
[void][NotchProbe]::SetThreadDpiAwarenessContext([IntPtr](-4))
$h=[NotchProbe]::Find($AppProcessId)
if($h -eq [IntPtr]::Zero){throw 'Visible Atoll window not found'}
$r=New-Object NotchProbe+Rect
[void][NotchProbe]::GetWindowRect($h,[ref]$r)
$m=New-Object NotchProbe+MonitorInfo
$m.Size=[System.Runtime.InteropServices.Marshal]::SizeOf($m)
[void][NotchProbe]::GetMonitorInfo([NotchProbe]::MonitorFromWindow($h,2),[ref]$m)
$dpi=[NotchProbe]::GetDpiForWindow($h)
$style=[NotchProbe]::GetWindowLongPtr($h,-20).ToInt64()
$region=[NotchProbe]::CreateRectRgn(0,0,0,0)
$kind=[NotchProbe]::GetWindowRgn($h,$region)
$probes=@()
if($ProbeFile) {
 foreach($p in (Get-Content -LiteralPath $ProbeFile -Raw | ConvertFrom-Json)) {
  $probes+=@{name=$p.name;expected=$p.expected;hit=[NotchProbe]::PtInRegion($region,[int][Math]::Round($p.x*$dpi/96),[int][Math]::Round($p.y*$dpi/96))}
 }
}
[void][NotchProbe]::DeleteObject($region)
@{foreground=[NotchProbe]::GetForegroundWindow().ToInt64();hwnd=$h.ToInt64();x=$r.Left;y=$r.Top;width=$r.Right-$r.Left;height=$r.Bottom-$r.Top;scale=$dpi/96;work=@{left=$m.Work.Left;top=$m.Work.Top;right=$m.Work.Right;bottom=$m.Work.Bottom};noActivate=($style-band0x08000000)-ne0;toolWindow=($style-band0x80)-ne0;topmost=($style-band8)-ne0;regionKind=$kind;probes=$probes}|ConvertTo-Json -Depth 5 -Compress
