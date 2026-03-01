export function ageInDays(date: Date): number {
  const currentDate = new Date();

  return Math.floor((currentDate.getTime() - date.getTime()) / 86400000);
}
