import { apiRequest, getToken } from "./api.js";

let pendingCustomersRequest = null;

export async function fetchCustomers() {
  const token = getToken();
  if (pendingCustomersRequest?.token === token) {
    return pendingCustomersRequest.promise;
  }

  const request = apiRequest("/admin/customers").finally(() => {
    if (pendingCustomersRequest?.promise === request) {
      pendingCustomersRequest = null;
    }
  });
  pendingCustomersRequest = { promise: request, token };
  return request;
}
