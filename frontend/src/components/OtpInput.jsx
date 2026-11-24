import { useRef } from 'react';

const LENGTH = 6;

// Six single-digit boxes that behave like one field:
// - typing moves to the next box
// - Backspace removes a digit and goes back
// - pasting "482913" fills all the boxes
// `value` is a plain string of digits ("482"), never with holes.
export default function OtpInput({ value, onChange, invalid = false, autoFocus = false }) {
  const refs = useRef([]);

  function focusBox(i) {
    refs.current[Math.min(Math.max(i, 0), LENGTH - 1)]?.focus();
  }

  function handleChange(i, e) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    // A box beyond the next free slot writes in the next free slot
    const pos = Math.min(i, value.length);
    onChange((value.slice(0, pos) + digit + value.slice(pos + 1)).slice(0, LENGTH));
    focusBox(pos + 1);
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const target = value[i] ? i : i - 1;
      if (target < 0) return;
      onChange(value.slice(0, target) + value.slice(target + 1));
      focusBox(target);
    } else if (e.key === 'ArrowLeft') {
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight') {
      focusBox(i + 1);
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!digits) return;
    onChange(digits);
    focusBox(digits.length);
  }

  return (
    <div className="otp" onPaste={handlePaste}>
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp__box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
