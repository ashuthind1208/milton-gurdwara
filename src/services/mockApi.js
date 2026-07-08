const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockResponse = async (data, delay = 450) => {
  await wait(delay);
  return { data };
};
