using System;
using System.Diagnostics;
using System.Windows.Forms;

namespace Launcher
{
    public partial class MainForm : Form
    {
        public MainForm()
        {
            InitializeComponent();
        }

        /// <summary>
        /// Launch NPM in the background
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void MainForm_Shown(object sender, EventArgs e)
        {
            //Start NPM
            Process process = new Process();
            ProcessStartInfo startInfo = new ProcessStartInfo()
            {
                WindowStyle = ProcessWindowStyle.Hidden,
                FileName = "npm",
                Arguments = "start"
            };
            process.StartInfo = startInfo;
            process.Start();
            //Exit
            Application.Exit();
        }
    }
}
