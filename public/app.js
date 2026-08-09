(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  // Collection / environment / submit controls
  const envInput = document.getElementById('envInput');
  const envPickerLabel = document.getElementById('envPickerLabel');
  const envFileNameLabel = document.getElementById('envFileNameLabel');
  const envClearBtn = document.getElementById('envClearBtn');
  const submitBtn = document.getElementById('submitBtn');

  const DEFAULT_ENV_LABEL = 'Add environment file (optional)';

  let selectedCollectionFile = null;
  let selectedEnvironmentFile = null;
  let retryCount = 0;
  const MAX_RETRIES = 5;


  const states = {
    idle: document.getElementById('state-idle'),
    running: document.getElementById('state-running'),
    done: document.getElementById('state-done'),
    error: document.getElementById('state-error'),
  };

  const runLog = document.getElementById('runLog');
  const runningFileName = document.getElementById('runningFileName');
  const doneFileName = document.getElementById('doneFileName');
  const errorFileName = document.getElementById('errorFileName');
  const errorMessage = document.getElementById('errorMessage');

  const resultBadge = document.getElementById('resultBadge');
  const resultCollectionName = document.getElementById('resultCollectionName');
  const resultEnvironmentName = document.getElementById('resultEnvironmentName');
  const statTotal = document.getElementById('statTotal');
  const statPassed = document.getElementById('statPassed');
  const statFailed = document.getElementById('statFailed');
  const statRate = document.getElementById('statRate');
  const openReportBtn = document.getElementById('openReportBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');

  const runAnotherBtn = document.getElementById('runAnotherBtn');
  const tryAgainBtn = document.getElementById('tryAgainBtn');


  // ---------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------

  function showState(name) {
    Object.values(states).forEach(el => {
      if (el) el.classList.add('hidden');
    });

    if (states[name]) {
      states[name].classList.remove('hidden');
    }
  }


  function clearEnvironmentSelection() {
    selectedEnvironmentFile = null;

    if (envInput) {
      envInput.value = '';
    }

    if (envFileNameLabel) {
      envFileNameLabel.textContent = DEFAULT_ENV_LABEL;
    }

    if (envPickerLabel) {
      envPickerLabel.classList.remove('has-file');
    }

    if (envClearBtn) {
      envClearBtn.classList.add('hidden');
    }
  }

  function resetToIdle() {

    selectedCollectionFile = null;
    selectedEnvironmentFile = null;

    retryCount = 0;

    fileInput.value = '';

    runLog.innerHTML = '';

    dropzoneEmptyState.classList.remove('hidden');
    dropzoneActiveState.classList.add('hidden');

    dropzone.classList.remove('has-file');

    selectedCollectionName.textContent =
      'Collection.json';

    clearEnvironmentSelection();

    submitBtn.disabled = true;

    showState('idle');
  }


  runAnotherBtn.addEventListener('click', resetToIdle);
  tryAgainBtn.addEventListener('click', () => {

    /*
     * Make sure there is still a collection available.
     */
    if (!selectedCollectionFile) {
      resetToIdle();
      return;
    }

    retryCount++;

    console.log(
      `Retry attempt ${retryCount} of ${MAX_RETRIES}`
    );


    /*
     * After 5 retry attempts, return the user
     * to the main upload page.
     */
    if (retryCount >= MAX_RETRIES) {

      console.log(
        'Maximum retry attempts reached. Resetting upload page.'
      );

      resetToIdle();

      return;
    }


    /*
     * Retry the same collection.
     *
     * The selected environment is also retained.
     */
    submitBtn.click();
  });




  // ---------------------------------------------------------
  // Environment file
  // ---------------------------------------------------------

  envInput.addEventListener('change', () => {
    const file = envInput.files?.[0];

    if (!file) {
      return;
    }

    if (!/\.json$/i.test(file.name)) {
      envInput.value = '';

      errorFileName.textContent = file.name;
      errorMessage.textContent =
        'The environment file needs to be a .json file.';

      showState('error');
      return;
    }

    selectedEnvironmentFile = file;

    envFileNameLabel.textContent = file.name;
    envPickerLabel.classList.add('has-file');
    envClearBtn.classList.remove('hidden');

    // IMPORTANT:
    // Selecting an environment file does NOT start the run.
    // The user must click Submit.
  });


  envClearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    clearEnvironmentSelection();
  });


  // ---------------------------------------------------------
  // Dropzone interactions
  // ---------------------------------------------------------

  const dropzoneEmptyState =
    document.getElementById('dropzoneEmptyState');

  const dropzoneActiveState =
    document.getElementById('dropzoneActiveState');

  const selectedCollectionName =
    document.getElementById('selectedCollectionName');


  dropzone.addEventListener('click', () => {
    fileInput.click();
  });


  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });


  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });


  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });


  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];

    if (file) {
      selectCollectionFile(file);
    }
  });


  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];

    if (file) {
      selectCollectionFile(file);
    }
  });


  // ---------------------------------------------------------
  // Collection selection
  // ---------------------------------------------------------

  function selectCollectionFile(file) {

    if (!/\.json$/i.test(file.name)) {
      errorFileName.textContent = file.name;

      errorMessage.textContent =
        'That file needs to be a .json Postman collection export.';

      showState('error');
      return;
    }

    /*
     * Store the collection.
     *
     * IMPORTANT:
     * We do NOT start the test here.
     */
    selectedCollectionFile = file;

    /*
     * Update dropzone to the active state.
     */
    selectedCollectionName.textContent = file.name;

    dropzoneEmptyState.classList.add('hidden');
    dropzoneActiveState.classList.remove('hidden');

    dropzone.classList.add('has-file');

    /*
     * Enable Submit.
     */
    if (submitBtn) {
      submitBtn.disabled = false;
    }

    /*
     * Keep the user on the upload screen.
     * They can now optionally select an environment
     * before clicking Submit.
     */
    showState('idle');
  }


  // ---------------------------------------------------------
  // Simulated log lines while the real request is in flight
  // ---------------------------------------------------------

  const LOG_STEPS = [
    'reading collection...',
    'connecting to endpoints...',
    'evaluating assertions...',
    'redacting headers & secrets...',
    'compiling report...',
  ];


  function playLogSequence() {
    runLog.innerHTML = '';

    let i = 0;

    const timer = setInterval(() => {

      if (i >= LOG_STEPS.length) {
        clearInterval(timer);
        return;
      }

      // Mark previous line as settled
      const prev = runLog.querySelector('.log-line.spin');

      if (prev) {
        prev.classList.remove('spin');
      }

      const line = document.createElement('p');

      line.className = 'log-line spin';
      line.textContent = LOG_STEPS[i];

      runLog.appendChild(line);

      i++;

    }, 550);

    return () => clearInterval(timer);
  }


  // ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------

  submitBtn.addEventListener('click', async () => {

    /*
     * A collection is mandatory.
     */
    if (!selectedCollectionFile) {
      return;
    }

    const collectionFile = selectedCollectionFile;

    /*
     * Disable Submit immediately to prevent double-clicking
     * and accidentally starting two test runs.
     */
    submitBtn.disabled = true;

    runningFileName.textContent = collectionFile.name;

    showState('running');

    const stopLog = playLogSequence();

    try {

      const formData = new FormData();

      formData.append(
        'collection',
        collectionFile
      );

      if (selectedEnvironmentFile) {
        formData.append(
          'environment',
          selectedEnvironmentFile
        );
      }

      let response;

      /*
       * Attempt to contact the backend.
       */
      try {

        response = await fetch('/api/run', {
          method: 'POST',
          body: formData,
        });

      } catch (networkError) {

        /*
         * Keep the original error for debugging.
         */
        console.error(
          'Network error:',
          networkError
        );

        /*
         * Convert technical browser error into
         * a user-friendly message.
         */
        throw new Error(
          'Something got in the way of starting your test. ' +
          'Please try again in a moment — ' +
          'your collection is still ready to run.'
        );
      }


      /*
       * Read the backend response.
       */
      let data;

      try {

        data = await response.json();

      } catch (parseError) {

        console.error(
          'Response parsing error:',
          parseError
        );

        throw new Error(
          'We received an unexpected response. ' +
          'Please try again in a moment.'
        );
      }


      stopLog();


      /*
       * Backend responded, but the test was not successful.
       */
      if (!response.ok || !data.success) {

        throw new Error(
          data.error ||
          'We couldn’t complete your test run. ' +
          'Please try again. Your collection is still ready to run.'
        );
      }


      /*
       * Successful run.
       */
      renderResult(
        collectionFile.name,
        data
      );


    } catch (err) {

      stopLog();

      console.error(
        'Test run error:',
        err
      );

      errorFileName.textContent =
        collectionFile.name;


      /*
       * The message has already been made user-friendly
       * for network/response errors above.
       */
      errorMessage.textContent =
        err.message ||
        'Something went wrong while running your test. ' +
        'Please try again.';


      /*
       * IMPORTANT:
       *
       * Do not clear:
       * - selectedCollectionFile
       * - selectedEnvironmentFile
       * - dropzone active state
       *
       * The user can simply click Try Again.
       */
      showState('error');
    }

    finally {

      /*
       * Re-enable Submit if the user remains on the page.
       *
       * If the state is "done" or "error", this does not
       * cause another run automatically.
       */

      submitBtn.disabled = !selectedCollectionFile;

    }
  });


  // ---------------------------------------------------------
  // Render result
  // ---------------------------------------------------------

  function renderResult(fileName, data) {

    doneFileName.textContent = fileName;

    resultCollectionName.textContent =
      data.collectionName || 'Collection';


    if (data.environmentName) {

      resultEnvironmentName.textContent =
        data.environmentName;

      resultEnvironmentName.classList.remove(
        'hidden'
      );

    } else {

      resultEnvironmentName.classList.add(
        'hidden'
      );
    }


    statTotal.textContent =
      data.totalRequests ?? 0;

    statPassed.textContent =
      data.passedRequests ?? 0;

    statFailed.textContent =
      data.failedRequests ?? 0;

    statRate.textContent =
      `${data.successRate ?? 0}%`;


    if ((data.failedRequests ?? 0) > 0) {

      resultBadge.textContent =
        `${data.failedRequests} FAILED`;

      resultBadge.classList.add(
        'has-failures'
      );

    } else {

      resultBadge.textContent =
        '🎉 All Passed!';

      resultBadge.classList.remove(
        'has-failures'
      );
    }


    openReportBtn.href =
      data.reportUrl;

    downloadJsonBtn.href =
      data.jsonUrl;


    if (downloadPdfBtn && data.pdfUrl) {
      downloadPdfBtn.href =
        data.pdfUrl;
    }


    showState('done');
  }

})();
