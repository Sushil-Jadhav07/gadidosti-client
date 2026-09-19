import { createSlice } from "@reduxjs/toolkit";

// Kept intentionally generic — this slice doesn't know BookTruck.jsx's INITIAL_FORM shape or
// field names, it just holds whatever `form` object the wizard hands it, plus which step it was
// on and (once one exists) the real booking's id. BookTruck.jsx owns the form's actual shape.
const initialState = {
  step: 1,
  form: null,
  bookingId: null,
};

const bookingWizardSlice = createSlice({
  name: "bookingWizard",
  initialState,
  reducers: {
    // One combined setter (not separate setStep/setForm/setBookingId actions) — BookTruck.jsx's
    // own write-through effect always has all three values at hand already (see its
    // step/form/createdBooking-watching effect), and a single action means a single history
    // entry instead of three, if this store ever grows Redux devtools time-travel usage.
    setWizardState(state, action) {
      const { step, form, bookingId } = action.payload || {};
      if (step !== undefined) state.step = step;
      if (form !== undefined) state.form = form;
      if (bookingId !== undefined) state.bookingId = bookingId;
    },
    // Back to a clean slate — used wherever the wizard fully restarts (resetFlow) or a booking
    // has reached a genuine end state (confirmed/delivered) and there's nothing left to resume.
    clearWizardState() {
      return initialState;
    },
  },
});

export const { setWizardState, clearWizardState } = bookingWizardSlice.actions;
export default bookingWizardSlice.reducer;
