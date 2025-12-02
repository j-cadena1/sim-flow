import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { SimRequest, Comment, User, RequestStatus, UserRole } from '../types';

// Requests API
export const useRequests = () => {
  return useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ requests: SimRequest[] }>('/requests');
      return data.requests;
    },
  });
};

export const useRequest = (id: string) => {
  return useQuery({
    queryKey: ['requests', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ request: SimRequest; comments: Comment[] }>(`/requests/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      vendor: string;
      priority: 'Low' | 'Medium' | 'High';
    }) => {
      const response = await apiClient.post<{ request: SimRequest }>('/requests', data);
      return response.data.request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
};

export const useUpdateRequestStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/status`, { status });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
    },
  });
};

export const useAssignEngineer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      engineerId,
      estimatedHours,
    }: {
      id: string;
      engineerId: string;
      estimatedHours: number;
    }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/assign`, {
        engineerId,
        estimatedHours,
      });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
    },
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      const response = await apiClient.post<{ comment: Comment }>(`/requests/${requestId}/comments`, { content });
      return response.data.comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests', variables.requestId] });
    },
  });
};

// Users API
export const useUsers = (role?: UserRole) => {
  return useQuery({
    queryKey: ['users', role],
    queryFn: async () => {
      const params = role ? { role } : {};
      const { data } = await apiClient.get<{ users: User[] }>('/users', { params });
      return data.users;
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ user: User }>('/users/me');
      return data.user;
    },
  });
};
