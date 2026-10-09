/**
 * The explanation shown in the Requests tab's collapsed "Can't be approved" group, so
 * nobody has to wonder later what these requests are or what Close does.
 */
export function describeUnapprovableRequests(count: number): string[] {
  const one = count === 1;
  return [
    `${count} ${one ? "request" : "requests"} can't be approved.`,
    `${one ? "This request was" : "These requests were"} sent by ${
      one ? "an applicant" : "applicants"
    } whose login no longer exists (the account was deleted, often by an automated test run), so ${
      one ? "it" : "they"
    } can never be approved.`,
    `A request that asked for a Founders' Club place keeps holding that place until it is closed.`,
    `Closing ${one ? "it" : "one"}: it is recorded as denied with your note, released from the Founders' Club count, and not deleted (it stays in the log). No email is sent, because the applicant can no longer sign in.`,
  ];
}
