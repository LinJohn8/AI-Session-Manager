using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;

namespace AISessionManagerLauncher;

internal static class Program
{
    private const string AppName = "AI Session Manager";
    private const string HealthVersion = "windows-codex-state-v2";
    private const string ServerExeName = "AI-Session-Manager-server.exe";
    private const int DefaultPort = 4747;

    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var context = new LauncherContext();
        Application.Run(context);
    }

    private sealed class LauncherContext : ApplicationContext
    {
        private readonly NotifyIcon trayIcon;
        private readonly int port;
        private readonly string appUrl;
        private Process? serverProcess;

        public LauncherContext()
        {
            port = ResolvePort();
            appUrl = $"http://127.0.0.1:{port}";

            var menu = new ContextMenuStrip();
            menu.Items.Add("Open", null, (_, _) => OpenBrowser());
            menu.Items.Add("Restart service", null, (_, _) => RestartServer());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit", null, (_, _) => Exit());

            trayIcon = new NotifyIcon
            {
                Icon = SystemIcons.Application,
                Text = AppName,
                ContextMenuStrip = menu,
                Visible = true
            };
            trayIcon.DoubleClick += (_, _) => OpenBrowser();

            StartServer();
            OpenBrowser();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                trayIcon.Dispose();
                StopServer();
            }

            base.Dispose(disposing);
        }

        private static int ResolvePort()
        {
            var value = Environment.GetEnvironmentVariable("PORT");
            if (int.TryParse(value, out var requestedPort) && requestedPort > 0)
            {
                return requestedPort;
            }

            return IsExpectedService(DefaultPort) || !IsPortOpen(DefaultPort) ? DefaultPort : FindFreePort();
        }

        private static string GetServerPath()
        {
            return Path.Combine(AppContext.BaseDirectory, ServerExeName);
        }

        private void StartServer()
        {
            if (IsExpectedService(port))
            {
                return;
            }

            var serverPath = GetServerPath();
            if (!File.Exists(serverPath))
            {
                MessageBox.Show(
                    $"Missing {ServerExeName}. Please rebuild the Windows package.",
                    AppName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                ExitThread();
                return;
            }

            serverProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = serverPath,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                },
                EnableRaisingEvents = true
            };
            serverProcess.StartInfo.Environment["PORT"] = port.ToString();
            serverProcess.Exited += (_, _) =>
            {
                if (!IsDisposed())
                {
                    trayIcon.ShowBalloonTip(3000, AppName, "The local service stopped.", ToolTipIcon.Warning);
                }
            };
            serverProcess.Start();
        }

        private void RestartServer()
        {
            StopServer();
            StartServer();
            OpenBrowser();
        }

        private void StopServer()
        {
            if (serverProcess is null)
            {
                return;
            }

            try
            {
                if (!serverProcess.HasExited)
                {
                    serverProcess.Kill(entireProcessTree: true);
                    serverProcess.WaitForExit(3000);
                }
            }
            catch
            {
                // The server may already be gone.
            }
            finally
            {
                serverProcess.Dispose();
                serverProcess = null;
            }
        }

        private static bool IsPortOpen(int port)
        {
            try
            {
                using var client = new TcpClient();
                return client.ConnectAsync(IPAddress.Loopback, port).Wait(TimeSpan.FromMilliseconds(250));
            }
            catch
            {
                return false;
            }
        }

        private static bool IsExpectedService(int port)
        {
            try
            {
                using var client = new HttpClient
                {
                    Timeout = TimeSpan.FromMilliseconds(800)
                };
                var body = client.GetStringAsync($"http://127.0.0.1:{port}/api/health").GetAwaiter().GetResult();
                return body.Contains(HealthVersion, StringComparison.Ordinal);
            }
            catch
            {
                return false;
            }
        }

        private static int FindFreePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var selectedPort = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return selectedPort;
        }

        private void OpenBrowser()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = appUrl,
                    UseShellExecute = true
                });
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private bool IsDisposed()
        {
            try
            {
                return !trayIcon.Visible;
            }
            catch
            {
                return true;
            }
        }

        private void Exit()
        {
            trayIcon.Visible = false;
            StopServer();
            ExitThread();
        }
    }
}
