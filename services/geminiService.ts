import { transcribeAndMark as apiTranscribe } from './api';

export const transcribeAndMark = async (
  problemDescription: string,
  imageBase64?: string,
  textAnswer?: string
): Promise<any> => {
  return apiTranscribe(problemDescription, imageBase64, textAnswer);
};
