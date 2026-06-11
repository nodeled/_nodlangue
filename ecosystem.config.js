module.exports = {
  apps: [
    {
      name: "nodlangue",
      script: "_nodlangue.js",
      cwd: "/home/panagram/sites/nodlangue.com",
      node_args: "--dns-result-order=ipv4first --max-old-space-size=256",
      env: {
        NODE_ENV: "production",
        UNDICI_NO_WASM: "1",
      },
      out_file:   "/home/panagram/sites/nodlangue.com/logs/out.log",
      error_file: "/home/panagram/sites/nodlangue.com/logs/error.log",
      merge_logs: true,
      time: true,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "256M",
    },
  ],
};
