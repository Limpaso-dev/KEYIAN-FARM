import api from "./api";

export const getAnimalFeeds = async () => {
  const response = await api.get("/animal-feeds");
  return response.data;
};

export const createAnimalFeed = async (feedData) => {
  const response = await api.post("/animal-feeds", feedData);
  return response.data;
};

export const updateAnimalFeed = async (id, feedData) => {
  const response = await api.put(`/animal-feeds/${id}`, feedData);
  return response.data;
};

export const deleteAnimalFeed = async (id) => {
  const response = await api.delete(`/animal-feeds/${id}`);
  return response.data;
};