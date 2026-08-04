import { useEffect } from 'react';

const normalizeLabel = (value) => String(value || '')
  .replace(/\(optional\)/gi, '')
  .replace(/\*/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const getFieldLabel = (field) => {
  const explicitLabel = field.labels?.[0]?.textContent;
  return normalizeLabel(explicitLabel || field.getAttribute('aria-label') || field.name || 'This field');
};

const getValidationMessage = (field) => {
  const label = getFieldLabel(field);
  const customMessage = field.getAttribute('data-validation-message');

  if (field.validity.valueMissing) {
    return `${label} is required.`;
  }
  if (field.validity.typeMismatch) {
    return `Enter a valid ${label.toLowerCase()}.`;
  }
  if (field.validity.patternMismatch && customMessage) {
    return customMessage;
  }
  if (field.validity.tooShort) {
    return `${label} must contain at least ${field.minLength} characters.`;
  }
  if (field.validity.tooLong) {
    return `${label} must contain no more than ${field.maxLength} characters.`;
  }
  if (field.validity.rangeUnderflow) {
    return `${label} must be at least ${field.min}.`;
  }
  if (field.validity.rangeOverflow) {
    return `${label} must be no more than ${field.max}.`;
  }
  if (field.validity.stepMismatch) {
    return `${label} has an invalid value.`;
  }
  return customMessage || `${label} has an invalid value.`;
};

const clearFieldError = (field) => {
  field.setCustomValidity('');
  field.removeAttribute('data-validation-error');
  const originalTitle = field.getAttribute('data-original-title');
  if (originalTitle === null) {
    field.removeAttribute('title');
  } else {
    field.setAttribute('title', originalTitle);
    field.removeAttribute('data-original-title');
  }
};

const FormValidationGuard = () => {
  useEffect(() => {
    const handleInvalid = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
        return;
      }

      field.form?.classList.add('form-validation-attempted');
      if (!field.hasAttribute('data-original-title') && field.hasAttribute('title')) {
        field.setAttribute('data-original-title', field.getAttribute('title') || '');
      }
      const message = getValidationMessage(field);
      field.setCustomValidity(message);
      field.setAttribute('data-validation-error', 'true');
      field.setAttribute('title', message);
    };

    const handleInput = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
        return;
      }
      clearFieldError(field);
      if (field.form?.classList.contains('form-validation-attempted') && !field.validity.valid) {
        if (!field.hasAttribute('data-original-title') && field.hasAttribute('title')) {
          field.setAttribute('data-original-title', field.getAttribute('title') || '');
        }
        field.setAttribute('data-validation-error', 'true');
        field.setAttribute('title', getValidationMessage(field));
      }
    };

    const handleReset = (event) => {
      window.requestAnimationFrame(() => {
        event.target.classList.remove('form-validation-attempted');
        event.target.querySelectorAll('[data-validation-error="true"]').forEach(clearFieldError);
      });
    };

    document.addEventListener('invalid', handleInvalid, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('reset', handleReset, true);

    return () => {
      document.removeEventListener('invalid', handleInvalid, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
      document.removeEventListener('reset', handleReset, true);
    };
  }, []);

  return null;
};

export default FormValidationGuard;