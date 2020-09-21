import { Elements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { SubscriptionApi } from 'api/subscriptionApi'
import GenericButton from 'components/input/generic_button'
import { PaypalPostSubscribeModal } from 'components/input/paypal_post_subscribe_modal'
import { PaypalProvider } from 'context/usePaypal'
import qs from 'qs'
import React, { useState } from 'react'
import { useAuth0 } from 'react-auth0-wrapper'
import { IconContext } from 'react-icons'
import { FaStripeS } from 'react-icons/fa'
import { IUseAuth0 } from 'types/auth0'
import { IUser } from 'types/user'
import { logClick } from 'utils/analytics'
import { isDev, STRIPE_KEY } from 'utils/env'
import { ISubscriptionPlan, SubscriptionPlans } from 'utils/plans'
import PayPalButton from './paypal/paypalButton'

const PricingPlansComponent: React.FC = () => {
  const { user }: IUseAuth0 = useAuth0()

  const [paypalModalIsOpen, setPaypalModalIsOpen] = useState(false)

  return (
    <PaypalProvider>
      <div className="container">
        <PlansHeader />

        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 justify-content-center text-center">
          {SubscriptionPlans.map((plan, i) => (
            <PlanComponent
              user={user}
              supportPlan={plan}
              paypalModalIsOpen={paypalModalIsOpen}
              setPaypalModalIsOpen={setPaypalModalIsOpen}
              key={i}
            />
          ))}
        </div>
        <div className="row text-center justify-content-center">
          <div className="col-12 col-sm-10 col-md-10 col-xl-8 col-xxl-6">
            <small>
              <em>
                AoS Reminders does not store your credit card information.
                <br />
                Subscriptions are managed by Stripe and PayPal. They can be canceled at any time.
                <br />
                You will have access to all subscription features until the end of your subscription, even if
                you cancel the recurring payments.
              </em>
            </small>
          </div>
        </div>
      </div>
    </PaypalProvider>
  )
}

const PlansHeader = () => {
  const hasSale = SubscriptionPlans.some(x => x.sale)

  return (
    <div className="col-12 bg-light text-center mb-3">
      <h2>
        Subscription Plans
        {hasSale && <span className="ml-2 badge badge-danger">Sale!</span>}
      </h2>
    </div>
  )
}

interface IPlanProps {
  user: IUser
  supportPlan: ISubscriptionPlan
  paypalModalIsOpen: boolean
  setPaypalModalIsOpen: (x: boolean) => void
}

const PlanComponent: React.FC<IPlanProps> = props => {
  const { user, supportPlan } = props
  const stripe = useStripe()
  const { isAuthenticated, loginWithRedirect }: IUseAuth0 = useAuth0()

  if (!stripe) return null

  // When the customer clicks on the Subscribe button, redirect them to Stripe Checkout.
  const handleStripeCheckout = async e => {
    e.preventDefault()

    logClick(supportPlan.title)

    const plan = isDev ? supportPlan.stripe_dev : supportPlan.stripe_prod
    const url = isDev ? 'localhost:3000' : 'aosreminders.com'

    const item = { plan, quantity: 1 }

    stripe
      .redirectToCheckout({
        items: [item],

        // Meta
        customerEmail: user.email, // Used to prefill checkout
        clientReferenceId: user.email, // Included in the checkout.session.completed webhook

        // Redirect after checkout
        successUrl: `${window.location.protocol}//${url}/?${qs.stringify({
          subscribed: true,
          plan: supportPlan.title,
        })}`,
        cancelUrl: `${window.location.protocol}//${url}/?${qs.stringify({
          canceled: true,
          plan: supportPlan.title,
        })}`,
      })
      .then(function (result) {
        if (result.error) {
          // If `redirectToCheckout` fails due to a browser or network
          // error, display the localized error message to your customer.
          console.error(result.error)
          // var displayError = document.getElementById('error-message');
          // displayError.textContent = result.error.message;
        }
      })
  }

  return (
    <div className="card mb-4 shadow-sm">
      <div className="card-header bg-themeDarkBluePrimary text-light">
        <h3 className="my-0 font-weight-normal">{supportPlan.title}</h3>
      </div>
      <div className="card-body">
        <h1 className="card-title pricing-card-title">
          ${supportPlan.monthly_cost}
          <small className="text-muted">/ month</small>
        </h1>
        <ul className="list-unstyled mt-3 mb-4">
          <li>
            {!!supportPlan.discount_pct && (
              <>
                <span className="badge badge-pill badge-danger mb-2">{supportPlan.discount_pct}% off!</span>
                <br />
              </>
            )}
            Total: ${supportPlan.cost}
          </li>
        </ul>

        <div className={'mx-3'}>
          <p className={'mb-0'}>Choose your payment method:</p>
          <IconContext.Provider value={{ size: '1.2em' }}>
            <GenericButton
              type="button"
              className="btn btn btn-block btn-primary btn-pill py-2"
              onClick={
                isAuthenticated
                  ? handleStripeCheckout
                  : () => loginWithRedirect({ redirect_uri: window.location.href })
              }
            >
              <FaStripeS className={'mr-2 align-self-center'} /> <strong>Stripe</strong>
            </GenericButton>
          </IconContext.Provider>
        </div>

        <PayPalComponent {...props} />
      </div>
    </div>
  )
}

const PayPalComponent = (props: IPlanProps) => {
  const { user }: IUseAuth0 = useAuth0()
  const [modalIsOpen, setModalIsOpen] = useState(false)

  const openModal = async () => {
    setModalIsOpen(true)
    props.setPaypalModalIsOpen(true)
    try {
      // Request a ten-minute temporary grant while Paypal approvals happen in the background
      await SubscriptionApi.requestGrant(user.email)
    } catch (err) {
      // pass
    }
  }
  const closeModal = () => {
    setModalIsOpen(false)
    props.setPaypalModalIsOpen(false)
  }

  const { paypal_dev, paypal_prod } = props.supportPlan

  return (
    <div className="col mt-2">
      {!props.paypalModalIsOpen && (
        <PayPalButton planId={isDev ? paypal_dev : paypal_prod} onSuccess={openModal} />
      )}
      {modalIsOpen && <PaypalPostSubscribeModal modalIsOpen={modalIsOpen} closeModal={closeModal} />}
    </div>
  )
}

const stripePromise = loadStripe(STRIPE_KEY)

export const PricingPlans = () => {
  return (
    <Elements stripe={stripePromise}>
      <PricingPlansComponent />
    </Elements>
  )
}
