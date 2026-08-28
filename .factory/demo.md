# Demo sandbox

Open <https://training-log-merge.sociobot.in/demo/> or select **Try it with sample data** on the home screen. `/?demo=1` is also supported.

The demo starts with five sessions in the current week: two runs, one strength session, one walk, and one mobility session. They use realistic notes and a mix of Watch export, Running app, Phone export, and Manual sources. The Field Kit backup and restore controls are available for evaluation without a purchase.

Demo changes use `sessionStorage` key `demo:training-log-merge:workouts`. Its time zone uses `demo:training-log-merge:timezone`. Demo mode does not open the real `training-log-merge` IndexedDB database and does not read or write real settings or license keys.

- **Reset demo** clears the demo keys and restores the five samples.
- **Start for real** clears the demo keys and opens the real ledger.
- Closing the tab lets the browser discard the demo namespace.

Every claim test starts with `/demo/` in a fresh browser context. Run the commands in `.factory/claims.json` or run the full suite with `npm run test:e2e`.
