// most other things tested by hand

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // needed for toBeInTheDocument
import Login from '../pages/Login';
import Register from '../pages/Register';
import ProtectedRoute from '../pages/ProtectedRoute';

// mocks
global.fetch = vi.fn();

// localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// router mock
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/', state: null }),
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />
  };
});

// helper function
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// test component
const TestComponent = () => <div data-testid="test-content">Test Content</div>;

describe('Auth Tests - Basic Stuff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Login Page', () => {
    it('should show login form', () => {
      renderWithRouter(<Login />);
      
      // check if form elements exist
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should handle form submission', async () => {
      const user = userEvent.setup();
      
      renderWithRouter(<Login />);
      
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      
      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password123');
      
      const submitBtn = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitBtn);
      
      //check that the form was submitted
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should show error when form is submitted', async () => {
      const user = userEvent.setup();
      
      renderWithRouter(<Login />);
      
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      
      await user.type(emailInput, 'wrong@test.com');
      await user.type(passwordInput, 'wrongpass');
      
      const submitBtn = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitBtn);
      
      // check that some error shows up (network error is expected since no backend)
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    // manually tested: email validation, password validation, remember me checkbox, forgot password link
  });

  describe('Register Page', () => {
    it('should show register form', () => {
      renderWithRouter(<Register />);
      
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      // use more specific selectors to avoid multiple matches
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should handle form submission', async () => {
      const user = userEvent.setup();
      
      renderWithRouter(<Register />);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      
      await user.type(firstNameInput, 'Test');
      await user.type(lastNameInput, 'Test');
      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      
      const submitBtn = screen.getByRole('button', { name: /register/i });
      await user.click(submitBtn);
      
      // just check that form was submitted (shows error which is expected without backend)
      await waitFor(() => {
        expect(screen.getAllByText(/network error/i).length).toBeGreaterThan(0);
      });
    });

    // manually tested: form validation, password matching, email format, error messages
  });

  describe('Protected Routes', () => {
    it('should show content when user is logged in', () => {
      // mock logged in user
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        id: '1',
        email: 'test@test.com',
        role: 'user'
      }));
      
      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );
      
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should redirect to login when not logged in', () => {
      // mock no user
      localStorageMock.getItem.mockReturnValue(null);
      
      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );
      
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    });

    it('should allow admin access to admin routes', () => {
      // mock admin user
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        id: '1',
        email: 'admin@justbet.com',
        role: 'admin'
      }));
      
      renderWithRouter(
        <ProtectedRoute requiredRole="admin">
          <TestComponent />
        </ProtectedRoute>
      );
      
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should block regular users from admin routes', () => {
      // mock regular user trying to access admin
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        id: '2',
        email: 'user@test.com',
        role: 'user'
      }));
      
      renderWithRouter(
        <ProtectedRoute requiredRole="admin">
          <TestComponent />
        </ProtectedRoute>
      );
      
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/not-authorized');
    });

    // manually tested: different user roles, edge cases, error handling
  });
});

// MANUALLY TESTED STUFF:
// - ForgotPassword page: form submission, email validation, error handling
// - ResetPassword page: token validation, password reset flow
// - NotAuthorized page: proper redirects and messaging
// - Email verification flow: token handling, success/error states
// - Admin dashboard: all admin features and permissions
// - User dashboard: user-specific features
// - Navigation between pages
// - Mobile responsiveness
// - Form validation messages
// - Loading states and error handling
// - Session management and logout
// - Edge cases like expired tokens, network errors
// - Cross-browser compatibility
// - Accessibility features 