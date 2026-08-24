import {
  homepageCategoryCards as fallbackCategoryCards,
  homepageOffers as fallbackOffers,
  reviews as fallbackReviews,
} from "../data/homeContent.js";
import { apiRequest } from "./api.js";

export async function fetchHomepageOffers() {
  try {
    return await apiRequest("/home-offers");
  } catch (error) {
    return fallbackOffers;
  }
}

export async function fetchAllHomepageOffers() {
  try {
    return await apiRequest("/home-offers/all");
  } catch (error) {
    return fallbackOffers;
  }
}

export async function fetchHomepageCategoryCards() {
  try {
    return await apiRequest("/home-offers/category-cards");
  } catch (error) {
    return fallbackCategoryCards;
  }
}

export async function fetchAllHomepageCategoryCards() {
  try {
    return await apiRequest("/home-offers/category-cards/all");
  } catch (error) {
    return fallbackCategoryCards;
  }
}

export async function saveHomepageCategoryCard(card) {
  return apiRequest(`/home-offers/category-cards/${card.key}`, {
    method: "PUT",
    body: JSON.stringify(card),
  });
}

export async function saveHomepageOffer(offer) {
  const exists = Boolean(offer.id);
  return apiRequest(exists ? `/home-offers/${offer.id}` : "/home-offers", {
    method: exists ? "PUT" : "POST",
    body: JSON.stringify(offer),
  });
}

export async function deleteHomepageOffer(offerId) {
  return apiRequest(`/home-offers/${offerId}`, {
    method: "DELETE",
  });
}

export async function fetchReviews() {
  try {
    return await apiRequest("/reviews");
  } catch (error) {
    return fallbackReviews.filter((review) => review.isActive);
  }
}

export async function fetchAllReviews() {
  try {
    return await apiRequest("/reviews/all");
  } catch (error) {
    return fallbackReviews;
  }
}

export async function saveReview(review) {
  const exists = Boolean(review.id);
  return apiRequest(exists ? `/reviews/${review.id}` : "/reviews", {
    method: exists ? "PUT" : "POST",
    body: JSON.stringify(review),
  });
}

export async function updateReviewStatus(reviewId, status, isActive = true) {
  return apiRequest(`/reviews/${reviewId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, isActive }),
  });
}

export async function submitCustomerReview(review) {
  return apiRequest("/reviews", {
    method: "POST",
    body: JSON.stringify(review),
  });
}

export async function deleteReview(reviewId) {
  return apiRequest(`/reviews/${reviewId}`, {
    method: "DELETE",
  });
}
