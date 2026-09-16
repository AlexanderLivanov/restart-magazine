import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() => new Promise(() => {}));
});

test('shows loading state while pages are fetched', () => {
  render(<App />);
  expect(screen.getByText(/загрузка страниц/i)).toBeInTheDocument();
});
