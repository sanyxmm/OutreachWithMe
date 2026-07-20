interface JobRoleFieldsProps {
  idPrefix: string;
  role: string;
  jobId: string;
  onRoleChange: (role: string) => void;
  onJobIdChange: (jobId: string) => void;
  disabled?: boolean;
}

function JobRoleFields({ idPrefix, role, jobId, onRoleChange, onJobIdChange, disabled }: JobRoleFieldsProps) {
  return (
    <section className="field job-role-field">
      <label className="rl-field-label" htmlFor={`${idPrefix}-job-role`}>
        Job role
      </label>
      <div className="job-role-inputs">
        <input
          id={`${idPrefix}-job-role`}
          type="text"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          placeholder="Role"
          aria-label="Role"
          disabled={disabled}
        />
        <input
          id={`${idPrefix}-job-id`}
          type="text"
          value={jobId}
          onChange={(e) => onJobIdChange(e.target.value)}
          placeholder="Job ID"
          aria-label="Job ID"
          disabled={disabled}
        />
      </div>
    </section>
  );
}

export default JobRoleFields;
