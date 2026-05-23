import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AppLogger } from './logger/app-logger.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  })
  app.useLogger(app.get(AppLogger))
  app.enableShutdownHooks()
  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
