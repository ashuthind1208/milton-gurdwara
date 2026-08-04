import { forwardRef } from 'react';
import {
  formatTenDigitPhone,
  TEN_DIGIT_PHONE_ERROR,
  TEN_DIGIT_PHONE_PATTERN,
  TEN_DIGIT_PHONE_PLACEHOLDER
} from '../../utils/phone';

const PhoneInput = forwardRef(({
  className = '',
  onChange,
  onFocus,
  onKeyDown,
  validationMessage = TEN_DIGIT_PHONE_ERROR,
  ...props
}, ref) => {
  const handleChange = (event) => {
    event.target.value = formatTenDigitPhone(event.target.value);
    onChange?.(event);
  };

  const handleKeyDown = (event) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && !/^\d$/.test(event.key)) {
      event.preventDefault();
      return;
    }
    onKeyDown?.(event);
  };

  const handleFocus = (event) => {
    event.target.value = formatTenDigitPhone(event.target.value);
    onFocus?.(event);
  };

  return (
    <input
      {...props}
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={14}
      pattern={TEN_DIGIT_PHONE_PATTERN}
      placeholder={props.placeholder || TEN_DIGIT_PHONE_PLACEHOLDER}
      data-validation-message={validationMessage}
      onChange={handleChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
});

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;