import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Campaign } from '../types/index.js';
import Alert from '../components/Alert.js';

export const CampaignsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isCreator = user?.role === 'CREATOR';

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/campaigns');
        if (res.ok) {
          const body = await res.json();
          setCampaigns(body.data || []);
        } else {
          setError('Failed to load campaigns.');
        }
      } catch {
        setError('Network error loading campaigns.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [user]);

  return (
    <div className="container">
      {/* Header and Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {isCreator ? 'Campaigns Dashboard' : 'Open Surveys & Reviews'}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {isCreator
              ? 'Manage and monitor your review campaigns and feedback collection.'
              : 'Browse active campaigns and submit your honest feedback.'}
          </p>
        </div>

        {isCreator && (
          <Link to="/campaigns/new" className="btn-primary">
            + Create Campaign
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className="tab-item active">
          {isCreator ? 'My Campaigns' : 'All Open Surveys'} ({campaigns.length})
        </div>
        {isCreator && (
          <div
            className="tab-item"
            onClick={() => navigate('/campaigns/new')}
          >
            + Create Campaign
          </div>
        )}
      </div>

      {/* Alert banner */}
      {error && <Alert type="error" message={error} />}

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
            Loading campaigns...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && campaigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
            No campaigns found
          </h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            {isCreator
              ? "You haven't created any campaigns yet. Click below to start your first one!"
              : 'There are no active surveys available for review at this moment.'}
          </p>
          {isCreator && (
            <Link to="/campaigns/new" className="btn-primary">
              Create Your First Campaign
            </Link>
          )}
        </div>
      )}

      {/* Campaign List */}
      {!loading && campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {campaigns.map((campaign) => (
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
                  <span
                    className={`badge ${
                      campaign.status === 'PUBLISHED' ? 'badge-published' : 'badge-closed'
                    }`}
                  >
                    {campaign.status}
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
                  <Link to={`/campaigns/${campaign.id}/results`} className="btn-outline">
                    View Results
                  </Link>
                ) : campaign.hasSubmitted ? (
                  <Link to={`/campaigns/${campaign.id}/respond`} className="btn-outline">
                    View Form
                  </Link>
                ) : (
                  <Link to={`/campaigns/${campaign.id}/respond`} className="btn-primary">
                    Take Survey
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
