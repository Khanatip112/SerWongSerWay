import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Campaign, CampaignStatus } from '../types/index.js';
import Alert from '../components/Alert.js';

function getEffectiveStatus(campaign: Campaign): CampaignStatus {
  if (
    campaign.status === 'PUBLISHED' &&
    campaign.closesAt &&
    new Date(campaign.closesAt) <= new Date()
  ) {
    return 'CLOSED';
  }
  return campaign.status;
}

export const CampaignsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');

  const isCreator = user?.role === 'CREATOR';

  useEffect(() => {
    const state = location.state as { accessError?: string } | null;
    if (state?.accessError) {
      setAccessError(state.accessError);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/campaigns');
        if (res.ok) {
          const body = await res.json();
          const list: Campaign[] = (body.data || []).map((c: Campaign) => ({
            ...c,
            status: getEffectiveStatus(c),
          }));
          setCampaigns(
            isCreator ? list : list.filter((c) => getEffectiveStatus(c) === 'PUBLISHED')
          );
        } else {
          setError('Failed to load surveys.');
        }
      } catch {
        setError('Network error loading surveys.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [user, isCreator]);

  return (
    <div className="container" style={{ width: '100%', boxSizing: 'border-box' }}>
      {accessError && (
        <Alert type="error" message={accessError} onClose={() => setAccessError('')} />
      )}

      {/* Tabs */}
      <div className="tabs">
        <div className="tab-item active">
          {isCreator ? 'My Surveys' : 'All Open Surveys'} ({campaigns.length})
        </div>
        {isCreator && (
          <div
            className="tab-item"
            onClick={() => navigate('/campaigns/new')}
          >
            + Create Survey
          </div>
        )}
      </div>

      {/* Alert banner */}
      {error && <Alert type="error" message={error} />}

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
            Loading surveys...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && campaigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
            No surveys found
          </h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            {isCreator
              ? "You haven't created any surveys yet. Click below to start your first one!"
              : 'There are no active surveys available for review at this moment.'}
          </p>
          {isCreator && (
            <Link to="/campaigns/new" className="btn-primary">
              Create Your First Survey
            </Link>
          )}
        </div>
      )}

      {/* Survey List */}
      {!loading && campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {campaigns.map((campaign) => {
            const status = getEffectiveStatus(campaign);
            const badgeClass =
              status === 'PUBLISHED'
                ? 'badge-published'
                : status === 'DRAFT'
                  ? 'badge-draft'
                  : 'badge-closed';

            return (
              <div
                key={campaign.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    {isCreator ? (
                      <span
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {campaign.title}
                      </span>
                    ) : (
                      <Link
                        to={`/campaigns/${campaign.id}/respond`}
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        {campaign.title}
                      </Link>
                    )}
                    <span className={`badge ${badgeClass}`}>
                      {status}
                    </span>
                    {campaign.hasSubmitted && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#f0fdf4',
                          color: 'var(--color-success)',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        ✓ Submitted
                      </span>
                    )}
                  </div>

                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {campaign.description}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {campaign.questions?.length || 0} Questions
                    {isCreator && campaign._count?.submissions !== undefined && (
                      <span> • {campaign._count.submissions} Submissions</span>
                    )}
                    {campaign.creator?.fullName && (
                      <span> • By {campaign.creator.fullName}</span>
                    )}
                    {campaign.closesAt && (
                      <span>
                        {' '}
                        • Closes:{' '}
                        {new Date(campaign.closesAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {isCreator ? (
                    status === 'DRAFT' ? (
                      <Link to={`/campaigns/${campaign.id}/edit`} className="btn-outline">
                        View Details
                      </Link>
                    ) : (
                      <Link to={`/campaigns/${campaign.id}/results`} className="btn-outline">
                        View Responses
                      </Link>
                    )
                  ) : campaign.hasSubmitted ? (
                    <Link to={`/campaigns/${campaign.id}/respond`} className="btn-outline">
                      View Responses
                    </Link>
                  ) : (
                    <Link to={`/campaigns/${campaign.id}/respond`} className="btn-primary">
                      Take Survey
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
