import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { USER_CREATED, type UserCreatedEvent } from '@/auth/events'

/**
 * Placeholder for the welcome-email side effect.
 *
 * Demonstrates how to plug a new `user.created` listener without touching
 * `UserCreatedHook`: just add a provider, the event fan-out is automatic.
 *
 * Internal try/catch is REQUIRED — listeners that throw cause the hook to
 * roll the user back (we explicitly do NOT want a failed welcome email to
 * undo a signup). Replace with a real mailer or a queue push when wiring
 * actual email delivery.
 */
@Injectable()
export class WelcomeEmailListener {
  private readonly logger = new Logger(WelcomeEmailListener.name)

  @OnEvent(USER_CREATED, { promisify: true })
  async handle({ user }: UserCreatedEvent): Promise<void> {
    try {
      this.logger.log(`[placeholder] Would send welcome email to ${user.email}`)
    } catch (err) {
      this.logger.error(`Welcome email failed for ${user.email}`, err)
    }
  }
}
