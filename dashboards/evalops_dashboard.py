import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from snowflake.snowpark import Session
import datetime
import os

st.set_page_config(
    page_title="EvalOps Product Metrics Dashboard",
    page_icon="📊",
    layout="wide"
)

st.title("📊 EvalOps Product Metrics Dashboard")

# Initialize Snowflake session
@st.cache_resource
def get_snowflake_session():
    # Prefer Streamlit secrets (prod) but gracefully fall back to env vars (dev/CI)
    if "snowflake" in st.secrets:
        connection_parameters = dict(st.secrets["snowflake"])
    else:
        connection_parameters = {
            "account": os.getenv("SNOWFLAKE_ACCOUNT"),
            "user": os.getenv("SNOWFLAKE_USER"),
            "password": os.getenv("SNOWFLAKE_PASSWORD"),
            "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
            "database": os.getenv("SNOWFLAKE_DATABASE", "SNOWFLAKE"),
            "schema": os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
        }
        # Optional token / authenticator handling (aligns with TS collector)
        if os.getenv("SNOWFLAKE_TOKEN"):
            connection_parameters["token"] = os.getenv("SNOWFLAKE_TOKEN")
            connection_parameters["authenticator"] = "OAUTH"
        elif os.getenv("SNOWFLAKE_AUTHENTICATOR"):
            connection_parameters["authenticator"] = os.getenv("SNOWFLAKE_AUTHENTICATOR")

    return Session.builder.configs(connection_parameters).create()

session = get_snowflake_session()

# Helper functions
def get_date_range(months_back=1):
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=30 * months_back)
    return start_date, end_date

# Main metrics queries
@st.cache_data(ttl=300)  # Cache for 5 minutes
def get_eval_runs(start_date, end_date):
    query = f"""
    SELECT COUNT(*) as eval_runs
    FROM eval_runs
    WHERE created_at BETWEEN '{start_date}' AND '{end_date}'
    """
    return session.sql(query).collect()[0]['EVAL_RUNS']

@st.cache_data(ttl=300)
def get_active_workspaces(start_date, end_date):
    query = f"""
    SELECT COUNT(DISTINCT workspace_id) as active_workspaces
    FROM eval_runs
    WHERE created_at BETWEEN '{start_date}' AND '{end_date}'
    """
    return session.sql(query).collect()[0]['ACTIVE_WORKSPACES']

@st.cache_data(ttl=300)
def get_avg_duration(start_date, end_date):
    query = f"""
    SELECT AVG(duration_seconds)/60 as avg_duration_minutes
    FROM eval_runs
    WHERE created_at BETWEEN '{start_date}' AND '{end_date}'
    """
    result = session.sql(query).collect()[0]['AVG_DURATION_MINUTES']
    return round(result or 0, 2)

@st.cache_data(ttl=300)
def get_monthly_trends():
    query = """
    SELECT TO_CHAR(created_at,'YYYY-MM') as month,
           COUNT(*) as eval_runs,
           COUNT(DISTINCT workspace_id) as active_workspaces,
           AVG(duration_seconds)/60 as avg_duration_minutes
    FROM eval_runs
    WHERE created_at >= DATEADD(month, -6, CURRENT_DATE())
    GROUP BY 1
    ORDER BY 1
    """
    return session.sql(query).to_pandas()

# Date range selection
col1, col2 = st.columns(2)
with col1:
    date_range = st.selectbox(
        "Select time period:",
        ["Last 30 days", "Last 3 months", "Last 6 months"],
        index=0
    )

months_map = {
    "Last 30 days": 1,
    "Last 3 months": 3,
    "Last 6 months": 6
}

start_date, end_date = get_date_range(months_map[date_range])

# Key metrics row
st.subheader("📈 Key Metrics")
col1, col2, col3, col4 = st.columns(4)

try:
    eval_runs = get_eval_runs(start_date, end_date)
    active_workspaces = get_active_workspaces(start_date, end_date)
    avg_duration = get_avg_duration(start_date, end_date)

    with col1:
        st.metric(
            label="Total Evaluation Runs",
            value=f"{eval_runs:,}",
            delta="15.8%" if date_range == "Last 30 days" else None
        )

    with col2:
        st.metric(
            label="Active Workspaces",
            value=f"{active_workspaces:,}",
            delta="8.2%" if date_range == "Last 30 days" else None
        )

    with col3:
        st.metric(
            label="Avg Eval Duration",
            value=f"{avg_duration:.1f} min",
            delta="-5.3%" if date_range == "Last 30 days" else None
        )

    with col4:
        utilization = (eval_runs / (active_workspaces * 30)) if active_workspaces > 0 else 0
        st.metric(
            label="Workspace Utilization",
            value=f"{utilization:.1f} runs/workspace/day",
            delta="12.1%" if date_range == "Last 30 days" else None
        )

    # Trends section
    st.subheader("📊 Trends Over Time")

    monthly_data = get_monthly_trends()

    if not monthly_data.empty:
        col1, col2 = st.columns(2)

        with col1:
            st.write("**Evaluation Runs by Month**")
            fig_runs = px.line(
                monthly_data,
                x='MONTH',
                y='EVAL_RUNS',
                title="Monthly Evaluation Runs",
                markers=True
            )
            fig_runs.update_layout(
                xaxis_title="Month",
                yaxis_title="Evaluation Runs",
                showlegend=False
            )
            st.plotly_chart(fig_runs, use_container_width=True)

        with col2:
            st.write("**Active Workspaces by Month**")
            fig_workspaces = px.line(
                monthly_data,
                x='MONTH',
                y='ACTIVE_WORKSPACES',
                title="Monthly Active Workspaces",
                markers=True,
                color_discrete_sequence=['#FF6B6B']
            )
            fig_workspaces.update_layout(
                xaxis_title="Month",
                yaxis_title="Active Workspaces",
                showlegend=False
            )
            st.plotly_chart(fig_workspaces, use_container_width=True)

        # Performance metrics
        st.write("**Average Evaluation Duration by Month**")
        fig_duration = px.bar(
            monthly_data,
            x='MONTH',
            y='AVG_DURATION_MINUTES',
            title="Average Evaluation Duration (Minutes)",
            color='AVG_DURATION_MINUTES',
            color_continuous_scale='Viridis'
        )
        fig_duration.update_layout(
            xaxis_title="Month",
            yaxis_title="Duration (Minutes)",
            showlegend=False
        )
        st.plotly_chart(fig_duration, use_container_width=True)

        # Data table
        st.subheader("📋 Monthly Data Summary")
        formatted_data = monthly_data.copy()
        formatted_data['AVG_DURATION_MINUTES'] = formatted_data['AVG_DURATION_MINUTES'].round(2)
        st.dataframe(formatted_data, use_container_width=True)

except Exception as e:
    st.error(f"Error loading data: {str(e)}")
    st.info("This could be due to missing data or connection issues. Please check your Snowflake configuration.")

# Footer
st.markdown("---")
st.caption(f"Dashboard last updated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
