import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import routes from "./routes";
import errorHandler from "./middleware/errorHandler";
import { getUploadRootPath } from "./shared/files/storage";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/files", express.static(path.resolve(getUploadRootPath())));

app.use("/api", routes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

app.use(errorHandler);

export default app;
