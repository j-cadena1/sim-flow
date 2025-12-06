/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimFlowProvider } from '../contexts/SimFlowContext';
import { ModalProvider } from './Modal';
import { ToastProvider } from './Toast';
import { RequestDetail } from './RequestDetail';
import { UserRole, RequestStatus, type User, type SimRequest } from '../types';
import { vi } from 'vitest';

// Test mock data
const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Test User', email: 'test@example.com', role: UserRole.USER },
  { id: 'eng-1', name: 'Test Engineer', email: 'engineer@example.com', role: UserRole.ENGINEER },
  { id: 'mgr-1', name: 'Test Manager', email: 'manager@example.com', role: UserRole.MANAGER },
];

const MOCK_REQUESTS: SimRequest[] = [
  {
    id: 'req-1',
    title: 'Test Request',
    description: 'This is a test request description',
    vendor: 'FANUC',
    status: RequestStatus.PENDING,
    priority: 'Medium',
    createdByName: 'Test User',
    createdAt: new Date().toISOString(),
    comments: [],
  },
];

// Mock the auth context
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.MANAGER,
};

vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    }),
  };
});

vi.mock('../lib/api/hooks', async (importOriginal) => {
  const actual = await importOriginal() as object;
  return {
    ...actual,
    useRequest: (id: string) => ({
      data: {
        request: MOCK_REQUESTS.find(r => r.id === id),
        comments: [],
      },
      isLoading: false,
      isError: false,
    }),
    useRequests: () => ({
      data: { data: MOCK_REQUESTS },
      isLoading: false,
      isError: false,
    }),
    useCreateRequest: () => ({ mutate: vi.fn() }),
    useUpdateRequestStatus: () => ({ mutate: vi.fn() }),
    useAssignEngineer: () => ({ mutate: vi.fn() }),
    useAddComment: () => ({ mutate: vi.fn(), isPending: false }),
    useUsers: () => ({ data: MOCK_USERS, isLoading: false, isError: false }),
    useProject: () => ({ data: null, isLoading: false, isError: false }),
    useUpdateProjectHours: () => ({ mutate: vi.fn() }),
    useDeleteRequest: () => ({ mutate: vi.fn(), isPending: false }),
    useTimeEntries: () => ({ data: { timeEntries: [] }, isLoading: false, isError: false }),
    useAddTimeEntry: () => ({ mutate: vi.fn(), isPending: false }),
    useTitleChangeRequests: () => ({ data: [], isLoading: false }),
    useRequestTitleChange: () => ({ mutate: vi.fn(), isPending: false }),
    useDiscussionRequests: () => ({ data: { discussionRequests: [] }, isLoading: false }),
    useCreateDiscussionRequest: () => ({ mutate: vi.fn(), isPending: false }),
    useReviewDiscussionRequest: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateRequestDescription: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateRequestTitle: () => ({ mutate: vi.fn(), isPending: false }),
    useReviewTitleChangeRequest: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const queryClient = new QueryClient();

const renderComponent = (id: string) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SimFlowProvider>
        <ModalProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/requests/${id}`]}>
              <Routes>
                <Route path="/requests/:id" element={<RequestDetail />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </ModalProvider>
      </SimFlowProvider>
    </QueryClientProvider>
  );
};

describe('RequestDetail', () => {
  it('should render request not found if request does not exist', async () => {
    renderComponent('invalid-id');
    expect(await screen.findByText('Request not found')).toBeInTheDocument();
  });

  it('should render request details correctly', async () => {
    const request = MOCK_REQUESTS[0];
    renderComponent(request.id);

    expect(await screen.findByText(request.title)).toBeInTheDocument();
    expect(screen.getByText(request.description)).toBeInTheDocument();
    expect(screen.getByText(request.vendor)).toBeInTheDocument();
  });
});
