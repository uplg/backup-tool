import Pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const pino = Pino({
  name: "BackupTool",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export default pino;
