import { api } from "./api.js";

export async function getMyTickets(): Promise<any[]> {
  return api("/support/tickets");
}

export async function createTicket(data: { subject: string; description: string; category?: string; priority?: string; logData?: string }): Promise<any> {
  return api("/support/tickets", { method: "POST", body: data });
}

export async function getTicket(id: string): Promise<any> {
  return api(`/support/tickets/${id}`);
}

export async function sendTicketMessage(ticketId: string, message: string): Promise<any> {
  return api(`/support/tickets/${ticketId}/messages`, { method: "POST", body: { message } });
}

export async function submitFeedback(data: { type: string; subject: string; description?: string; screenshot?: string; logData?: string }): Promise<any> {
  return api("/support/feedback", { method: "POST", body: data });
}

export async function getFeatureRequests(): Promise<any[]> {
  return api("/support/feature-requests");
}

export async function createFeatureRequest(data: { title: string; description?: string; category?: string }): Promise<any> {
  return api("/support/feature-requests", { method: "POST", body: data });
}

export async function toggleVote(featureRequestId: string): Promise<{ voted: boolean }> {
  return api(`/support/feature-requests/${featureRequestId}/vote`, { method: "POST" });
}
