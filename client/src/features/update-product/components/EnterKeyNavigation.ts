import React from 'react';

/**
 * Handles Enter key navigation in table input fields.
 * When Enter is pressed, moves focus to the next input in the same column.
 * If the current input is the last in the column, focus stays on the current field.
 */
export const handleEnterKeyNavigation = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Enter') return;

  event.preventDefault();

  const currentInput = event.currentTarget;
  const column = currentInput.getAttribute('data-column');

  if (!column) return;

  // Find all inputs in the same column across all pages
  const allInputsInColumn = document.querySelectorAll<HTMLInputElement>(
    `input[data-column="${column}"]`
  );

  // Find current input's index
  const currentIndex = Array.from(allInputsInColumn).indexOf(currentInput);

  // If not the last input, move to next
  if (currentIndex < allInputsInColumn.length - 1) {
    const nextInput = allInputsInColumn[currentIndex + 1];
    nextInput?.focus();
  }
  // If last input, stay on current field (do nothing)
};
