import { PASSWORD_MIN_LENGTH, passwordProblem } from '@m-ensemble/shared';
import { fill, type Strings } from '@/i18n';

/**
 * `passwordProblem()` from the shared contract, in the app's words.
 *
 * Sign-up, reset and change-password all validate the same way, and the
 * server applies the identical rule — so nothing the client lets through is
 * refused later. Returns null when the password is acceptable.
 */
export function passwordProblemMessage(password: string, t: Strings): string | null {
  switch (passwordProblem(password)) {
    case 'too_short':
      return fill(t.passwordTooShort, { min: String(PASSWORD_MIN_LENGTH) });
    case 'too_long':
      return t.passwordTooLong;
    case 'too_common':
      return t.passwordTooCommon;
    default:
      return null;
  }
}
