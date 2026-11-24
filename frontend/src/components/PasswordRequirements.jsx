import { PASSWORD_RULES } from '../utils/passwordRules';

export default function PasswordRequirements({ password }) {
  return (
    <div className="reqs">
      <p className="reqs__title">Password requirements</p>
      <ul>
        {PASSWORD_RULES.map((rule) => (
          <li key={rule.id} className={rule.test(password) ? 'is-met' : ''}>
            <span className="reqs__box" aria-hidden="true" />
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
